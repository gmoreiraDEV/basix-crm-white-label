import { type FieldErrors, type FieldValues, type Resolver } from "react-hook-form";
import { z } from "zod";

export const simpleZodResolver = <
  TSchema extends z.ZodTypeAny,
  TFieldValues extends FieldValues = z.infer<TSchema>,
>(schema: TSchema): Resolver<TFieldValues> =>
  async (values) => {
    const result = schema.safeParse(values);

    if (result.success) {
      return { values: result.data as TFieldValues, errors: {} as FieldErrors<TFieldValues> };
    }

    const fieldErrors = result.error.flatten().fieldErrors;
    const formErrors: FieldErrors<TFieldValues> = {} as FieldErrors<TFieldValues>;

    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (messages?.length) {
        formErrors[field as keyof TFieldValues] = {
          type: "validation",
          message: messages[0],
        } as FieldErrors<TFieldValues>[keyof TFieldValues];
      }
    }

    return { values: {} as TFieldValues, errors: formErrors };
  };
