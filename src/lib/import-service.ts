import crypto from "crypto";

import { ImportAction, ImportStatus, Prisma, WebhookStatus } from "@prisma/client";

import { prisma } from "@/lib/db";

type ContactImportRow = {
  externalId?: string | null;
  email?: string | null;
  name: string;
  phone?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

type ImportOptions = {
  source?: string;
  externalUploadId?: string;
  dryRun?: boolean;
};

type BatchOptions = {
  triggerWebhooks?: boolean;
};

type SerializedContact = {
  id: string;
  tenantId: string;
  externalId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

function serializeContact(contact: {
  id: string;
  tenantId: string;
  externalId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}): SerializedContact {
  return {
    ...contact,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

export async function startContactImport(
  tenantId: string,
  totalRecords: number,
  options: ImportOptions = {}
) {
  return prisma.importJob.create({
    data: {
      tenantId,
      source: options.source,
      externalUploadId: options.externalUploadId,
      dryRun: options.dryRun ?? false,
      totalRecords,
      status: ImportStatus.PENDING,
    },
  });
}

export async function processContactBatch(
  jobId: string,
  tenantId: string,
  rows: ContactImportRow[],
  options: BatchOptions = {}
) {
  if (!rows.length) return null;

  return prisma.$transaction(async (tx) => {
    const job = await tx.importJob.findUnique({ where: { id: jobId } });

    if (!job || job.tenantId !== tenantId) {
      throw new Error("Import job not found for this tenant");
    }

  const dryRun = job.dryRun;
  const webhookPayloads: Prisma.WebhookEventCreateManyInput[] = [];
  let failedRecords = 0;

    await tx.importJob.update({
      where: { id: jobId },
      data: { status: ImportStatus.PROCESSING },
    });

    for (const row of rows) {
      const externalId = row.externalId?.trim() || null;
      const email = row.email?.trim() || null;
      const tags = row.tags ?? [];
      const metadata = row.metadata as Prisma.InputJsonValue | undefined;
      const matchByExternalId = externalId
        ? await tx.contact.findUnique({ where: { tenantId_externalId: { tenantId, externalId } } })
        : null;
      const existingContact =
        matchByExternalId ??
        (email
          ? await tx.contact.findUnique({ where: { tenantId_email: { tenantId, email } } })
          : null);

      if (existingContact) {
        const before = serializeContact(existingContact);
        const updatedContact = dryRun
          ? existingContact
          : await tx.contact.update({
              where: { id: existingContact.id },
              data: {
                name: row.name ?? existingContact.name,
                email: email ?? existingContact.email,
                phone: row.phone ?? existingContact.phone,
                tags: tags.length ? tags : existingContact.tags,
                externalId: externalId ?? existingContact.externalId,
              },
            });

        await tx.importRecord.create({
          data: {
            jobId,
            contactId: existingContact.id,
            externalId,
            action: ImportAction.MERGED,
            mergedIntoId: existingContact.id,
            metadata: {
              dryRun,
              matchedBy: matchByExternalId ? "externalId" : "email",
              payload: metadata,
            },
          },
        });

        await tx.importChange.create({
          data: {
            jobId,
            entityType: "contact",
            entityId: existingContact.id,
            before,
            after: serializeContact(updatedContact),
          },
        });

        if (options.triggerWebhooks && !dryRun) {
          webhookPayloads.push({
            id: crypto.randomUUID(),
            tenantId,
            jobId,
            type: "contact.merged",
            payload: {
              contactId: existingContact.id,
              externalId,
            },
            status: WebhookStatus.PENDING,
          });
        }

        continue;
      }

      const createdContact = dryRun
        ? null
        : await tx.contact.create({
            data: {
              tenantId,
              externalId,
              name: row.name,
              email,
              phone: row.phone ?? null,
              tags,
            },
          });

      await tx.importRecord.create({
        data: {
          jobId,
          contactId: createdContact?.id,
          externalId,
          action: dryRun ? ImportAction.SKIPPED : ImportAction.CREATED,
          metadata: {
            dryRun,
            note: dryRun
              ? "Registro não persistido (dry-run)."
              : "Registro criado com sucesso.",
            payload: metadata,
          },
        },
      });

      await tx.importChange.create({
        data: {
          jobId,
          entityType: "contact",
          entityId: createdContact?.id ?? undefined,
          before: null,
          after: createdContact ? serializeContact(createdContact) : null,
        },
      });

      if (options.triggerWebhooks && !dryRun && createdContact) {
        webhookPayloads.push({
          id: crypto.randomUUID(),
          tenantId,
          jobId,
          type: "contact.created",
          payload: serializeContact(createdContact),
          status: WebhookStatus.PENDING,
        });
      }
    }

    if (options.triggerWebhooks && webhookPayloads.length && !dryRun) {
      await tx.webhookEvent.createMany({ data: webhookPayloads });
    }

    const newProcessedRecords = job.processedRecords + rows.length;
    const status =
      job.totalRecords === 0 || newProcessedRecords >= job.totalRecords
        ? ImportStatus.COMPLETED
        : ImportStatus.PROCESSING;

    await tx.importJob.update({
      where: { id: jobId },
      data: {
        processedRecords: { increment: rows.length },
        failedRecords: { increment: failedRecords },
        status,
        completedAt: status === ImportStatus.COMPLETED ? new Date() : null,
      },
    });
  });
}

export async function markImportFailed(jobId: string, errorMessage: string) {
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: ImportStatus.FAILED, errorMessage, completedAt: new Date() },
  });
}

export async function purgeImportJob(jobId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.importRecord.deleteMany({ where: { jobId } });
    await tx.importChange.deleteMany({ where: { jobId } });
    await tx.webhookEvent.deleteMany({ where: { jobId } });
    await tx.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportStatus.CANCELED,
        deletedAt: new Date(),
        source: null,
        externalUploadId: null,
      },
    });
  });
}

export async function cleanupTemporaryUploads(olderThanDays = 30) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  return prisma.importJob.deleteMany({
    where: {
      deletedAt: { lte: cutoff },
    },
  });
}
