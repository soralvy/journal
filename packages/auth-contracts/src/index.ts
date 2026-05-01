const defineAuthAdditionalFields = <
  T extends Record<
    string,
    {
      defaultValue?: string;
      required: boolean;
      type: "date" | "string";
    }
  >,
>(
  fields: T,
) => fields;

export const authAdditionalFields = defineAuthAdditionalFields({
  username: { type: "string", required: false },
  role: { type: "string", required: true, defaultValue: "USER" },
  deletedAt: { type: "date", required: false },
});
