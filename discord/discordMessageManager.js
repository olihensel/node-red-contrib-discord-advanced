module.exports = function (RED) {
  var discordBotManager = require('./lib/discordBotManager.js');
  const Flatted = require('flatted');
  const {
    MessageAttachment,
    MessageEmbed,
    MessageActionRow,
    MessageButton,
    MessageSelectMenu
  } = require('discord.js');

  const checkString = (field) => typeof field === 'string' ? field : false; 

  function discordMessageManager(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    var configNode = RED.nodes.getNode(config.token);    

    discordBotManager.getBot(configNode).then(function (bot) {
      node.on('input', async function (msg, send, done) {
        const channel = config.channel || msg.channel || null;
        const action = msg.action || 'create';
        const user = msg.user || null;
        const content = msg.payload?.content || checkString(msg.payload) || ' ';
        const messageId = msg.message || null;
        const inputEmbeds = msg.payload?.embeds || msg.payload?.embed || msg.embeds || msg.embed;
        const timeDelay = msg.payload?.timedelay || msg.timedelay || 0;
        const inputAttachments = msg.payload?.attachments || msg.payload?.attachment || msg.attachments || msg.attachment;        
        const inputComponents = msg.payload?.components || msg.components;       

        const setError = (error) => {
          node.status({
            fill: "red",
            shape: "dot",
            text: error
          })
          done(error);
        }

        const setSuccess = (succesMessage, data) => {
          node.status({
            fill: "green",
            shape: "dot",
            text: succesMessage
          });          
          
          msg.payload = Flatted.parse(Flatted.stringify(data));
          send(msg);
          done();
        }

        const checkIdOrObject = (check) => {
          try {
            if (typeof check !== 'string') {
              if (check.hasOwnProperty('id')) {
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
        }

        const getChannel = async (id) => 
        {
          const channelID = checkIdOrObject(id);
          if (!channelID) {
            throw(`msg.channel wasn't set correctly`);
          }
          return await bot.channels.fetch(channelID);
        }

        const getMessage = async (channel, message) => {
          const channelID = checkIdOrObject(channel);
          const messageID = checkIdOrObject(message);
          if (!channelID) {
            throws(`msg.channel wasn't set correctly`);
          } else if (!messageID) {
            throws(`msg.message wasn't set correctly`)
          }

          let channelInstance = await bot.channels.fetch(channelID);
          return await channelInstance.messages.fetch(messageID);
        }

        const createPrivateMessage = async () => {
          const userID = checkIdOrObject(user);
          if (!userID) {
            setError(`msg.user wasn't set correctly`);
            return;
          }          
          try {
            let user = await bot.users.fetch(userID);
            let messageObject = {
              embeds: embeds,
              content: content,
              files: attachments,
              components: components
            };
            let resultMessage = await user.send(messageObject);
            setSuccess(`message sent to ${resultMessage.channel.recipient.username}`, resultMessage);
          } catch (err) {
            setError(err);
          }      
        }

        const createChannelMessage = async () => {
          try {
            let channelInstance = await getChannel(channel);
            let messageObject = {
              embeds: embeds,
              content: content,
              files: attachments,
              components: components
            };
            let resultMessage = await channelInstance.send(messageObject);
            setSuccess(`message sent, id = ${resultMessage.id}`, resultMessage);
          } catch (err) {
            setError(err);
          }      
        }

        const createMessage = async () => {
          if (user) {
            await createPrivateMessage();
          } else if (channel) {
            await createChannelMessage();
          } else {
            setError('to send messages either msg.channel or msg.user needs to be set');
          }
        }

        const editMessage = async () => {
          try {
            let message = await getMessage(channel, messageId)
            let messageObject = {
              embeds: embeds,
              content: content,
              files: attachments,
              components: components
            };
            message = await message.edit(messageObject);
            setSuccess(`message ${message.id} edited`, message);
          } catch (err) {
            setError(err);
          }
        }

        const deleteMessage = async () => {
          try {
            let message = await getMessage(channel, messageId);
            let resultMessage = await message.delete({
              timeout: timeDelay
            });
            setSuccess(`message ${resultMessage.id} deleted`, resultMessage);
          } catch (err) {
            setError(err);
          }        
        }

        const replyMessage = async () => {
          try {
            let message = await getMessage(channel, messageId)
            let messageObject = {
              embeds: embeds,
              content: content,
              files: attachments,
              components: components
            };
            message = await message.reply(messageObject);
            setSuccess(`message ${message.id} replied`, message);
          } catch (err) {
            setError(err);
          }          
        }

        var attachments = [];
        if (inputAttachments) {
          if (typeof inputAttachments === 'string') {
            attachments.push(new MessageAttachment(inputAttachments));
          } else if (Array.isArray(inputAttachments)) {
            inputAttachments.forEach(attachment => {
              attachments.push(new MessageAttachment(attachment));
            });
          } else {
            setError("msg.attachments isn't a string or array")
          }
        }

        var embeds = [];
        if (inputEmbeds) {
          if (Array.isArray(inputEmbeds)) {
            inputEmbeds.forEach(embed => {
              embeds.push(new MessageEmbed(embed));
            });
          } else if  (typeof inputEmbeds === 'object') {
            embeds.push(new MessageEmbed(inputEmbeds));
          } else {
            setError("msg.embeds isn't a string or array")
          }
        }

        var components = [];
        if (inputComponents) {
          inputComponents.forEach(component => {
            if(component.type == 1 || component.type == "ACTION_ROW")
            {
              var actionRow = new MessageActionRow();
              component.components.forEach(subComponentData => {
                switch (subComponentData.type) {
                  case 2:
                  case "BUTTON":
                    actionRow.addComponents(new MessageButton(subComponentData));
                    break;
                  case 3:
                  case "SELECT":
                    actionRow.addComponents(new MessageSelectMenu(subComponentData));                    
                    break;
                }
              });
              components.push(actionRow);
            }                       
          });        
        }

        switch (action.toLowerCase()) {
          case 'create':
            await createMessage();
            break;
          case 'edit':
            await editMessage();
            break;
          case 'delete':
            await deleteMessage();
            break;
          case 'reply':
            await replyMessage();
            break;
          default:
            setError(`msg.action has an incorrect value`)
        }

        node.on('close', function () {
          discordBotManager.closeBot(bot);
        });
      });
    }).catch(err => {
      console.log(err);
      node.status({
        fill: "red",
        shape: "dot",
        text: err
      });
    });
  }
  RED.nodes.registerType("discordMessageManager", discordMessageManager);
};
