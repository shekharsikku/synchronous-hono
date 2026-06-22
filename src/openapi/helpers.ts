import { z } from "@hono/zod-openapi";

export type ZodSchema = z.ZodUnion | z.ZodObject | z.ZodArray<z.ZodObject>;
export type ZodIssue = z.core.$ZodIssue;

export const jsonContent = <T extends ZodSchema>(schema: T, description: string) => {
  return {
    content: {
      "application/json": {
        schema,
      },
    },
    description,
  };
};

export const jsonRequired = <T extends ZodSchema>(schema: T, description: string) => {
  return {
    ...jsonContent(schema, description),
    required: true,
  };
};

export const multipartRequired = <TKey extends string>(key: TKey, description: string) => {
  return {
    required: true,
    content: {
      "multipart/form-data": {
        schema: z.object({
          [key]: z.instanceof(File).openapi({
            type: "string",
            format: "binary",
          }),
        }),
      },
    },
    description,
  };
};

export const pathParams = <TName extends string>(name: TName) => {
  return z.object({
    [name]: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
      .openapi({
        param: {
          name,
          in: "path",
          required: true,
        },
        required: [name],
        example: "6878d1b8d9c8d8d7c9b0a123",
      }),
  } as Record<TName, z.ZodString>);
};

export const queryParams = {
  required: <T extends z.ZodType>(name: string, schema: T, example: z.infer<T>) => {
    return schema.openapi({
      param: {
        name,
        in: "query",
        required: true,
      },
      example,
    });
  },

  optional: <T extends z.ZodType>(name: string, schema: T, example: z.infer<T>) => {
    return schema.optional().openapi({
      param: {
        name,
        in: "query",
        required: false,
      },
      example,
    });
  },
};

export const errorSchema = (example?: Partial<{ message: string; error: any }>) => {
  return z
    .object({
      success: z.literal(false),
      message: z.string().min(3),
      error: z.any().optional(),
    })
    .openapi({
      example: {
        success: false,
        message: "Request could not be completed!",
        ...example,
      },
    });
};

export const successSchema = (example?: Partial<{ message: string; data: any }>) => {
  return z
    .object({
      success: z.literal(true),
      message: z.string().min(3),
      data: z.any().optional(),
    })
    .openapi({
      example: {
        success: true,
        message: "Request completed successfully!",
        ...example,
      },
    });
};
