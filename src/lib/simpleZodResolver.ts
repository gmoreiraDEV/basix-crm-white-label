import { type Resolver } from "react-hook-form";
import { z } from "zod";

export const simpleZodResolver = <TSchema extends z.ZodTypeAny>(schema: TSchema): Resolver<z.infer<TSchema>> => async (values) => {
  const result = schema.safeParse(values);

  if (result.success) {
    return { values: result.data, errors: {} };
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  const formErrors: Record<string, { type: string; message?: string }> = {};

  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages?.length) {
      formErrors[field] = { type: "validation", message: messages[0] };
    }
  }

  return { values: {}, errors: formErrors };
};
