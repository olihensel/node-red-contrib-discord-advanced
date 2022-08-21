const Flatted = require("flatted");
module.exports = function (RED) {
  var discordBotManager = require("./lib/discordBotManager.js");

  function discordFetchMessage(config) {
    RED.nodes.createNode(this, config);
    var configNode = RED.nodes.getNode(config.token);
    var node = this;
    discordBotManager
      .getBot(configNode)
      .then(function (bot) {
        node.on("input", async function (msg, send, done) {
          const channelId =
            config.channel || msg.channelId || msg.channel || null;
          const messageId = msg.message || msg.id || null;
          const setError = (error) => {
            node.status({
              fill: "red",
              shape: "dot",
              text: error,
            });
            done(error);
          };

          const setSuccess = (successMessage, data) => {
            node.status({
              fill: "green",
              shape: "dot",
              text: successMessage,
            });

            msg.payload = Flatted.parse(Flatted.stringify(data));
            send(msg);
            done();
          };

          const checkIdOrObject = (check) => {
            try {
              if (typeof check !== "string") {
                if (check.hasOwnProperty("id")) {
                  return check.id;
                } else {
                  return false;
                }
              } else {
                return check;
              }
            } catch (error) {
              return false;
            }
          };

          const getMessage = async (channel, message) => {
            const channelID = checkIdOrObject(channel);
            const messageID = checkIdOrObject(message);
            if (!channelID) {
              throws(`msg.channel wasn't set correctly`);
            } else if (!messageID) {
              throws(`msg.message wasn't set correctly`);
            }

            let channelInstance = await bot.channels.fetch(channelID);
            return await channelInstance.messages.fetch(messageID);
          };

          const message = await getMessage(channelId, messageId);
          const outMessage = {
            payload: message.content,
            channel: Flatted.parse(Flatted.stringify(message.channel)),
            member: Flatted.parse(Flatted.stringify(message.member)),
            memberRoleNames: message.member
              ? message.member.roles.cache.each(function (item) {
                  return item.name;
                })
              : null,
            memberRoleIDs: message.member
              ? message.member.roles.cache.each(function (item) {
                  return item.id;
                })
              : null,
          };
          // TODO: read commit history... wtf
          try {
            outMessage.data = Flatted.parse(Flatted.stringify(message));
            outMessage.data.attachments = Flatted.parse(
              Flatted.stringify(message.attachments)
            );
            outMessage.data.reference = message.reference;
            // TODO: probablyy also use flatted (if necessary). this leads to a error on emoji buttons, maybe due to Object.getOwnProperies?
            outMessage.data.embeds = message.embeds;
            outMessage.data.components = message.components;
          } catch (e) {
            node.warn("Could not set `msg.data`: JSON serialization failed");
          }

          if (message.author.bot) {
            // TODO: lolwut, consider lodash
            outMessage.author = {
              id: message.author.id,
              bot: message.author.bot,
              system: message.author.system,
              flags: message.author.flags,
              username: message.author.bot,
              discriminator: message.author.discriminator,
              avatar: message.author.avatar,
              createdTimestamp: message.author.createdTimestamp,
              tag: message.author.tag,
            };
          } else {
            const author = await msg.author.fetch(true);
            outMessage.author = Flatted.parse(Flatted.stringify(author));
          }
          node.send(outMessage);

          node.on("close", function () {
            discordBotManager.closeBot(bot);
          });
        });
      })
      .catch((err) => {
        console.log(err);
        node.status({
          fill: "red",
          shape: "dot",
          text: err,
        });
      });
  }
  RED.nodes.registerType("discordFetchMessage", discordFetchMessage);
};
