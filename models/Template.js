const mongoose = require("mongoose");

const TemplateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  templates: [
    {
      name: { type: String, required: true },
      language: {
        policy: { type: String, default: "deterministic" },
        code: { type: String, default: "en" },
      },
      components: [
        {
          type: { type: String },
          parameters: [
            {
              value: { type: String, default: "lead_name" }, // lead_name, company_name
              fallback_value: { type: String, default: "N/A" },
            },
          ],
        },
      ],
    },
  ],
});

module.exports = mongoose.model("Template", TemplateSchema);
