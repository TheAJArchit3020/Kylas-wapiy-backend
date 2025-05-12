const axios = require("axios");
const User = require("../models/User");
const API_WAPIY = "https://apis.whatsapp.redingtongroup.com";
const API_KYLAS = "https://api.kylas.io/v1";
const PARTNER_API_KEY = process.env.WAPIY_PARTNER_API_KEY;

// **1. Fetch Lead Details from Kylas**
const getSenderPhoneNumber = async (projectId) => {
  try {
    const response = await axios.get(
      `${API_WAPIY}/project-apis/v1/project/${projectId}`,
      {
        headers: { "X-Partner-API-Key": PARTNER_API_KEY },
      }
    );
    console.log("sender Phone Number: ", response.data.wa_number);
    return response.data.wa_number || null;
  } catch (error) {
    console.error(
      "❌ Error fetching sender phone number:",
      error.response?.data || error.message
    );
    return null;
  }
};
const getProjectId = async (userId) => {
  const user = await User.findOne({ kylasUserId: userId });
  if (!user || !user.projectId) {
    throw new Error("Project ID not found for this user.");
  }
  return user.projectId;
};
const getTemplateIdFromRedington = async (projectId, templateName) => {
  try {
    const response = await axios.get(
      `${API_WAPIY}/project-apis/v1/project/${projectId}/wa_template/?limit=100`,
      {
        headers: { "X-Partner-API-Key": PARTNER_API_KEY },
      }
    );

    const templates = response.data.template || []; // Corrected to extract templates from "template" key
    // console.log("Redington template list:", templates);

    const template = templates.find((t) => t.name === templateName);
    console.log("Redington Template Object:", template);

    return template ? template.id : null;
  } catch (error) {
    console.error(
      "❌ Error fetching WA templates:",
      error.response?.data || error.message
    );
    return null;
  }
};

const getTemplateTextFromRedington = async (projectId, waTemplateId) => {
  try {
    const response = await axios.get(
      `${API_WAPIY}/project-apis/v1/project/${projectId}/wa_template/${waTemplateId}`,
      {
        headers: { "X-Partner-API-Key": PARTNER_API_KEY },
      }
    );
    console.log("template text redington: ", response.data.text);
    return response.data.text || null;
  } catch (error) {
    console.error(
      "❌ Error fetching WA template details:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Function to fetch lead details
 */
exports.getLeadDetails = async (req, res) => {
  try {
    const { leadId, userId, entityType } = req.params;

    console.log("entity Type", entityType);
    // Find user in the database
    let user = await User.findOne({ kylasUserId: userId });

    if (!user || !user.projectId) {
      return res.status(404).json({
        error:
          "Project not found, Please connect a project in details page of the app",
      });
    }

    if (!user || !user.kylasAPIKey) {
      return res.status(404).json({
        error:
          "API Key not found. Please update your API Key in the API Access tab.",
      });
    }

    let kylasAPIKey = user.kylasAPIKey;
    console.log("Using Kylas API Key:", kylasAPIKey);

    let response;
    if (entityType === "deal") {
      const dealResponse = await axios.get(`${API_KYLAS}/deals/${leadId}`, {
        headers: {
          "api-key": kylasAPIKey, // Using API Key instead of Bearer Token
        },
      });
      console.log("The deal response", dealResponse.data);
      console.log("lead id", dealResponse.data.customFieldValues.cfLeadId);
      response = await axios.get(
        `${API_KYLAS}/leads/${dealResponse.data.customFieldValues.cfLeadId}`,
        {
          headers: {
            "api-key": kylasAPIKey, // Using API Key instead of Bearer Token
          },
        }
      );
    } else {
      response = await axios.get(`${API_KYLAS}/leads/${leadId}`, {
        headers: {
          "api-key": kylasAPIKey, // Using API Key instead of Bearer Token
        },
      });
      console.log("lead id", leadId);
    }
    // Fetch lead details

    const leadData = response.data;

    if (!leadData || !leadData.phoneNumbers) {
      return res.status(404).json({ error: "No phone numbers found" });
    }

    // Extract phone numbers
    const phoneNumbers = leadData.phoneNumbers.map((phone) => ({
      type: phone.type,
      number: phone.value,
      dialCode: phone.dialCode,
    }));

    // Extract lead name (firstName + lastName)
    const leadName = `${leadData.firstName || ""} ${
      leadData.lastName || ""
    }`.trim();

    res.json({ phoneNumbers, leadName });
  } catch (error) {
    console.error(
      "Error fetching lead details:",
      error.response?.data || error
    );
    res.status(500).json({ error: "Failed to fetch lead details" });
  }
};

exports.checkOrCreateContact = async (req, res) => {
  try {
    const { userId, phoneNumber, name } = req.body; // Accept name in request body
    const user = await User.findOne({ kylasUserId: userId });
    if (!user || !user.projectId) {
      return res.status(404).json({
        error:
          "Project not found, Please connect a project in details page of the app",
      });
    }
    // Get project ID from the user database
    const projectId = await getProjectId(userId);

    let contact = null;

    // Step 1: Check if contact exists in Wapiy
    try {
      const fetchResponse = await axios.get(
        `${API_WAPIY}/project-apis/v1/project/${projectId}/contact?action=FetchContact&mobile_number=${phoneNumber}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Partner-API-Key": PARTNER_API_KEY,
          },
        }
      );
      contact = fetchResponse.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log("Contact not found. Creating a new one...");

        // Step 2: Create contact if not found
        const createResponse = await axios.post(
          `${API_WAPIY}/project-apis/v1/project/${projectId}/contact`,
          { mobile_number: phoneNumber, name: name || "Unknown" }, // Send name
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Partner-API-Key": PARTNER_API_KEY,
            },
          }
        );
        contact = createResponse.data;
      } else {
        console.error(
          "Error fetching contact:",
          error.response?.data || error.message
        );
        return res.status(500).json({ error: "Failed to fetch contact" });
      }
    }

    res.json({
      is_intervened: contact.is_intervened,
      is_requesting: contact.is_requesting,
    });
  } catch (error) {
    console.error(
      "Error in checkOrCreateContact:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch/create contact" });
  }
};

const logMessageInKylas = async ({
  userId,
  senderNumber,
  recipientNumber,
  messageContent,
  recipientName,
  attachments = [],
  recipientEntity,
  recipientId,
  relatedEntity,
  relatedId,
}) => {
  try {
    const user = await User.findOne({ kylasUserId: userId });
    if (!user) throw new Error("User not found");

    const kylasAPIKey = user.kylasAPIKey;

    const payload = {
      content: messageContent,
      messageType: "whatsapp",
      ownerId: userId,
      senderNumber: Number(senderNumber),
      recipientNumber: Number(recipientNumber),
      direction: "outgoing",
      sentAt: new Date().toISOString(),
      status: "sent",
      recipients: [
        {
          entity: recipientEntity,
          id: Number(recipientId),
          phoneNumber: Number(recipientNumber),
          name: recipientName || "Customer",
        },
      ],
      relatedTo: [
        {
          entity: relatedEntity,
          id: Number(relatedId),
          phoneNumber: Number(recipientNumber),
          name: recipientName || "Customer",
        },
      ],
      attachments,
    };

    console.log(
      "📨 Logging message in Kylas:",
      JSON.stringify(payload, null, 2)
    );

    await axios.post(`${API_KYLAS}/messages`, payload, {
      headers: {
        "api-key": kylasAPIKey,
      },
    });

    console.log("✅ Message logged in Kylas CRM");
  } catch (error) {
    console.error(
      "❌ Error logging message in Kylas:",
      error.response?.data || error.message
    );
  }
};
// **2. Send Normal Message**
exports.sendMessage = async (req, res) => {
  try {
    const { userId, to, message, leadId, imageUrl, entityType } = req.body;
    const user = await User.findOne({ kylasUserId: userId });
    if (!user || !user.projectId) {
      return res.status(404).json({
        error:
          "Project not found, Please connect a project in details page of the app",
      });
    }
    // Get project ID from the user database
    const projectId = await getProjectId(userId);

    // Fetch sender phone number for the project
    const senderNumber = await getSenderPhoneNumber(projectId);
    if (!senderNumber)
      return res
        .status(500)
        .json({ error: "Failed to fetch sender phone number" });

    // Prepare the payload for WhatsApp API
    const payload = {
      recipient_type: "individual",
      to,
      type: imageUrl ? "image" : "text",
      ...(imageUrl
        ? { image: { link: imageUrl } } // Attach image if provided
        : { text: { body: message } }), // Otherwise, send text
    };

    console.log(
      "🚀 Sending Normal WhatsApp Message:",
      JSON.stringify(payload, null, 2)
    );

    await axios.post(
      `${API_WAPIY}/project-apis/v1/project/${projectId}/messages`,
      payload,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Partner-API-Key": PARTNER_API_KEY,
        },
      }
    );

    const attachments = imageUrl
      ? [{ fileName: "uploaded_image.jpg", url: imageUrl }]
      : [];
    if (entityType === "deal") {
      const dealRes = await axios.get(`${API_KYLAS}/deals/${leadId}`, {
        headers: { "api-key": user.kylasAPIKey },
      });
      const deal = dealRes.data;
      const cfLeadId = deal.customFieldValues?.cfLeadId;

      const leadRes = cfLeadId
        ? await axios.get(`${API_KYLAS}/leads/${cfLeadId}`, {
            headers: { "api-key": user.kylasAPIKey },
          })
        : null;

      const lead = leadRes?.data || null;
      const recipientName = lead
        ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim()
        : "Customer";

      // 1. contact → deal
      for (const contact of deal.associatedContacts || []) {
        await logMessageInKylas({
          userId,
          senderNumber,
          recipientNumber: to,
          messageContent: message,
          recipientName: contact.name,
          attachments,
          recipientEntity: "contact",
          recipientId: contact.id,
          relatedEntity: "deal",
          relatedId: deal.id,
        });
      }

      if (lead) {
        // 3. lead → lead
        await logMessageInKylas({
          userId,
          senderNumber,
          recipientNumber: to,
          messageContent: message,
          recipientName,
          attachments,
          recipientEntity: "lead",
          recipientId: lead.id,
          relatedEntity: "lead",
          relatedId: lead.id,
        });
      }
    } else {
      const leadRes = await axios.get(`${API_KYLAS}/leads/${leadId}`, {
        headers: { "api-key": user.kylasAPIKey },
      });
      const lead = leadRes.data;
      const leadName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim();
      const phone = lead.phoneNumbers?.[0]?.value;

      await logMessageInKylas({
        userId,
        senderNumber,
        recipientNumber: to,
        messageContent: message,
        recipientName: leadName,
        attachments,
        recipientEntity: "lead",
        recipientId: lead.id,
        relatedEntity: "lead",
        relatedId: lead.id,
      });
      const contactSearchBody = {
        jsonRule: {
          condition: "AND",
          valid: true,
          rules: [
            {
              id: "multi_field",
              field: "multi_field",
              type: "multi_field",
              input: "multi_field",
              operator: "multi_field",
              value: `+${phone}`,
            },
          ],
        },
      };

      const contactsRes = await axios.post(
        `${API_KYLAS}/search/contact?page=0&size=10`,
        contactSearchBody,
        {
          headers: {
            "api-key": kylasAPIKey,
            "Content-Type": "application/json",
          },
        }
      );

      const contacts = contactsRes.data.content || [];
      for (const contact of contacts) {
        const contactName = `${contact.firstName || ""} ${
          contact.lastName || ""
        }`.trim();
        const dealSearchBody = {
          jsonRule: {
            condition: "AND",
            valid: true,
            rules: [
              {
                id: "multi_field",
                field: "multi_field",
                type: "multi_field",
                input: "multi_field",
                operator: "multi_field",
                value: contactName,
              },
            ],
          },
        };

        const dealsRes = await axios.post(
          `${API_KYLAS}/search/deal?page=0&size=10`,
          dealSearchBody,
          {
            headers: {
              "api-key": kylasAPIKey,
              "Content-Type": "application/json",
            },
          }
        );

        const deals = dealsRes.data.content || [];
        for (const deal of deals) {
          await logMessageInKylas({
            userId,
            senderNumber,
            recipientNumber: to,
            messageContent: message,
            recipientName: contact.name,
            attachments,
            recipientEntity: "contact",
            recipientId: contact.id,
            relatedEntity: "deal",
            relatedId: deal.id,
          });
        }
      }
    }

    // Log the message in Kylas CRM

    res.json({ message: "Message sent successfully!" });
  } catch (error) {
    console.error(
      "❌ Error sending message:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to send message." });
  }
};

exports.sendTemplateMessage = async (req, res) => {
  try {
    const { userId, to, template, leadId, entityType } = req.body;

    // Fetch user details
    const user = await User.findOne({ kylasUserId: userId });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.projectId)
      return res.status(404).json({
        error:
          "Project not found, Please connect a project in details page of the app",
      });
    const projectId = user.projectId;
    const senderNumber = await getSenderPhoneNumber(projectId);
    if (!senderNumber)
      return res
        .status(500)
        .json({ error: "Failed to fetch sender phone number" });
    const waTemplateId = await getTemplateIdFromRedington(
      projectId,
      template.name
    );
    if (!waTemplateId) {
      console.error("Whatsapptemplate not found");
      return res.status(404).json({ error: "WhatsApp template not found" });
    }

    // Fetch the actual template text from Redington
    let messageContent = await getTemplateTextFromRedington(
      projectId,
      waTemplateId
    );
    if (!messageContent)
      return res.status(500).json({ error: "Failed to fetch template text" });

    const sanitizedTemplate = JSON.parse(JSON.stringify(template));
    delete sanitizedTemplate.type;

    const attachments = [];
    const parameterValues = [];

    // Replace placeholders dynamically in components
    sanitizedTemplate.components.forEach((component) => {
      if (component.parameters) {
        component.parameters.forEach((param, index) => {
          const formattedParam = { type: param.type };

          if (param.type === "text") {
            // Replace lead_name or company_name
            if (param.text === "lead_name") {
              formattedParam.text = leadName;
              param.text = leadName;
            } else if (param.text === "company_name") {
              formattedParam.text = companyName;
            } else {
              formattedParam.text = param.text;
            }

            parameterValues.push(formattedParam.text);
          } else if (param.type === "image" && param.image?.link) {
            attachments.push({ fileName: "image.jpg", url: param.image.link });
          } else if (param.type === "video" && param.video?.link) {
            attachments.push({ fileName: "video.mp4", url: param.video.link });
          } else if (param.type === "document" && param.document?.link) {
            attachments.push({
              fileName: param.document.filename || "document.pdf",
              url: param.document.link,
            });
          }
        });

        // Remove fallback_value to prevent API error
        component.parameters = component.parameters.map(
          ({ fallback_value, ...param }) => param
        );
      }
    });
    console.log(JSON.stringify(sanitizedTemplate, null, 2));
    // Replace placeholders {{1}}, {{2}}, etc., in the message text with actual values
    messageContent = messageContent.replace(/{{(\d+)}}/g, (match, number) => {
      return parameterValues[number - 1] || match;
    });

    // Prepare final payload for WhatsApp API
    const payload = {
      to,
      type: "template",
      template: sanitizedTemplate,
    };

    await axios.post(
      `${API_WAPIY}/project-apis/v1/project/${projectId}/messages`,
      payload,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Partner-API-Key": PARTNER_API_KEY,
        },
      }
    );

    console.log("✅ Template message sent successfully!");
    console.log("Message Content: ", messageContent);
    if (entityType === "deal") {
      const deal = await axios
        .get(`${API_KYLAS}/deals/${leadId}`, {
          headers: { "api-key": user.kylasAPIKey },
        })
        .then((res) => res.data);

      const cfLeadId = deal.customFieldValues?.cfLeadId;
      const lead = cfLeadId
        ? await axios
            .get(`${API_KYLAS}/leads/${cfLeadId}`, {
              headers: { "api-key": user.kylasAPIKey },
            })
            .then((res) => res.data)
        : null;

      const recipientName = lead
        ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim()
        : "Customer";

      for (const contact of deal.associatedContacts || []) {
        await logMessageInKylas({
          userId,
          senderNumber,
          recipientNumber: to,
          messageContent,
          recipientName: contact.name,
          attachments,
          recipientEntity: "contact",
          recipientId: contact.id,
          relatedEntity: "deal",
          relatedId: deal.id,
        });
      }

      // contact → lead
      if (lead) {
        await logMessageInKylas({
          userId,
          senderNumber,
          recipientNumber: to,
          messageContent,
          recipientName,
          attachments,
          recipientEntity: "lead",
          recipientId: lead.id,
          relatedEntity: "lead",
          relatedId: lead.id,
        });
      }
    } else {
      const lead = await axios
        .get(`${API_KYLAS}/leads/${leadId}`, {
          headers: { "api-key": user.kylasAPIKey },
        })
        .then((res) => res.data);
      const leadName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim();

      await logMessageInKylas({
        userId,
        senderNumber,
        recipientNumber: to,
        messageContent,
        recipientName: leadName,
        attachments,
        recipientEntity: "lead",
        recipientId: lead.id,
        relatedEntity: "lead",
        relatedId: lead.id,
      });
      const contactSearchBody = {
        jsonRule: {
          condition: "AND",
          valid: true,
          rules: [
            {
              id: "multi_field",
              field: "multi_field",
              type: "multi_field",
              input: "multi_field",
              operator: "multi_field",
              value: `+${phone}`,
            },
          ],
        },
      };

      const contactsRes = await axios.post(
        `${API_KYLAS}/search/contact?page=0&size=10`,
        contactSearchBody,
        {
          headers: {
            "api-key": user.kylasAPIKey,
            "Content-Type": "application/json",
          },
        }
      );
      const contacts = contactsRes.data.content || [];
      for (const contact of contacts) {
        const contactName = `${contact.firstName || ""} ${
          contact.lastName || ""
        }`.trim();
        const dealSearchBody = {
          jsonRule: {
            condition: "AND",
            valid: true,
            rules: [
              {
                id: "multi_field",
                field: "multi_field",
                type: "multi_field",
                input: "multi_field",
                operator: "multi_field",
                value: contactName,
              },
            ],
          },
        };

        const dealsRes = await axios.post(
          `${API_KYLAS}/search/deal?page=0&size=10`,
          dealSearchBody,
          {
            headers: {
              "api-key": user.kylasAPIKey,
              "Content-Type": "application/json",
            },
          }
        );

        const deals = dealsRes.data.content || [];
        for (const deal of deals) {
          await logMessageInKylas({
            userId,
            senderNumber,
            recipientNumber: to,
            messageContent,
            recipientName: contact.name,
            attachments,
            recipientEntity: "contact",
            recipientId: contact.id,
            relatedEntity: "deal",
            relatedId: deal.id,
          });
        }
      }
    }

    res.json({ message: "Template message sent successfully!" });
  } catch (error) {
    console.error(
      "❌ Error sending template message:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to send template message." });
  }
};
