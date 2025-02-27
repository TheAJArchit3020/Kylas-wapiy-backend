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
          type: { type: String, required: true },
          parameters: [
            {
              type: { type: String, required: true }, // text, image, video, document
              text: { type: String }, // For text-based parameters
              image: { link: String }, // For image-based parameters
              video: { link: String }, // For video-based parameters
              document: { link: String, filename: String }, // For document-based parameters
              fallback_value: { type: String, default: "N/A" }, // Default fallback value
            },
          ],
        },
      ],
    },
  ],
});

module.exports = mongoose.model("Template", TemplateSchema);
