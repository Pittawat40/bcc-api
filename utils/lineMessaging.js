// utils/lineMessaging.js
const line = require("@line/bot-sdk");

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

async function notifyNewAppointment({ name, phone, email, service, message }) {
  const groupId = process.env.LINE_GROUP_ID;
  if (!groupId) return;

  try {
    await client.pushMessage({
      to: groupId,
      messages: [
        {
          type: "flex",
          altText: `📅 นัดหมายใหม่จาก ${name}`,
          contents: {
            type: "bubble",
            size: "mega",
            header: {
              type: "box",
              layout: "vertical",
              paddingAll: "20px",
              background: {
                type: "linearGradient",
                angle: "135deg",
                startColor: "#c7a25e",
                endColor: "#8B6914",
              },
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "📅",
                      size: "xxl",
                      flex: 0,
                    },
                    {
                      type: "box",
                      layout: "vertical",
                      margin: "md",
                      contents: [
                        {
                          type: "text",
                          text: "นัดหมายใหม่",
                          color: "#ffffff",
                          weight: "bold",
                          size: "xl",
                        },
                        {
                          type: "text",
                          text: new Date().toLocaleString("th-TH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }),
                          color: "#FFE8B2",
                          size: "sm",
                          margin: "xs",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            body: {
              type: "box",
              layout: "vertical",
              spacing: "none",
              paddingAll: "0px",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  backgroundColor: "#FFF8EE",
                  paddingAll: "20px",
                  contents: [
                    {
                      type: "text",
                      text: `คุณ${name}`,
                      size: "md",
                      weight: "bold",
                      color: "#8B6914",
                      wrap: true,
                    },
                  ],
                },
                { type: "separator" },
                {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "20px",
                  spacing: "lg",
                  contents: [
                    buildRow("📞", "โทรศัพท์", formatPhone(phone)),
                    buildRow("✉️", "อีเมล", email || "-"),
                    buildRow("💼", "บริการ", service || "-"),
                    buildRow("📝", "หมายเหตุ", message || "-"),
                  ],
                },
              ],
            },
            footer: {
              type: "box",
              layout: "vertical",
              paddingAll: "16px",
              spacing: "sm",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  color: "#b88a36",
                  height: "sm",
                  action: {
                    type: "uri",
                    label: "เปิดหน้า Dashboard",
                    uri: process.env.DASHBOARD_URL,
                  },
                },
              ],
            },
          },
        },
      ],
    });
    console.log("LINE notify sent ✅");
  } catch (e) {
    console.error("LINE Messaging error:", e.message);
  }
}

function formatPhone(phone) {
  if (!phone) return "-";

  const digits = String(phone).replace(/\D/g, "");

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return String(phone);
}

function buildRow(icon, label, value) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: icon,
            flex: 0,
            size: "sm",
          },
          {
            type: "text",
            text: label,
            size: "sm",
            color: "#888888",
            weight: "bold",
          },
        ],
      },
      {
        type: "box",
        layout: "vertical",
        paddingStart: "22px",
        contents: [
          {
            type: "text",
            text: value,
            size: "sm",
            color: "#333333",
            wrap: true,
          },
        ],
      },
    ],
  };
}

module.exports = { notifyNewAppointment };
