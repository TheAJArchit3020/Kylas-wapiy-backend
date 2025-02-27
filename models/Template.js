const mongoose = require("mongoose");

const TemplateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User collection
  templates: [
    {
      name: { type: String, required: true },
      type: { type: String, required: true },
      language: {
        policy: { type: String, default: "deterministic" },
        code: { type: String, default: "en" },
      },
      components: [
        {
          type: { type: String, required: true },
          parameters: [
            {
              type: { type: String, required: true },
              text: { type: String },
              image: { link: String },
              video: { link: String },
              document: { link: String, filename: String },
              coupon_code: { type: String },
            },
          ],
        },
      ],
    },
  ],
});

module.exports = mongoose.model("Template", TemplateSchema);
