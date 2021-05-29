#!

const Discord = require("discord.js");
const fs      = require("fs");

const commands = require("./commands.json");
const config   = require("./config.json");
let   data     = require("./data.json");

const eyes = "👀";

const client = new Discord.Client({
    intents: ["GUILD_MESSAGES", "GUILDS"]
});

client.on("ready", () => {
    commands.commandList.forEach((cm) => {
        console.log(`posting ${JSON.stringify(cm.name)}`);
        client.api.applications(client.user.id).guilds("696529468247769149")
              .commands.post({data: cm});
    })
    
});

let selfSent = 0;

let lock = 0;

/**
 * Save the data object to the disk.
 * Also makes a backup of the data.
 */
function saveData() {
    
    //file write in progress
    if(lock === 1)
        return;
    
    try {
        //lock
        lock = 1;
        
        fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));
    } catch(e) {
        //err
        console.error(e);
    } finally {
        //rm lock
        lock = 0;
    }
}

function backupData() {
    if(lock === 1)
        setTimeout(backupData, 3000);
    
    lock = 1;
    
    try {
        fs.renameSync("./data.json", `./backs/data-back-${Date.now()}.json`);
    } catch(ignored) {}
    
    lock = 0;
}

setInterval(() => {
    saveData();
}, 10000);

setInterval(() => {
    backupData();
}, 10800000)

function reply(id, token, content) {
    
    if(content.includes(eyes)) selfSent++;
    
    client.api.interactions(id, token).callback.post({
        data: {
            type: 4,
            data: {
                content: content
            }
        }
    });
}

/**
 * Get if a number should be plural or not.
 * 
 * @param number {number} the number to check.
 * @return {string} `s` or an empty string.
 */
function plural(number) {
    return number === 1 ? "" : "s";
}

/**
 * Get the thing (st, nd, rd, th).
 * I hate this.
 * @param number {number} the number to check.
 * @return {string} the string
 */
function getNumberEndingThing(number) {
    
    let tmp;
    
    if(number % 10 === 1 && number !== 11) {
        tmp = 'st';
    } else if(number % 10 === 2 && number !== 12) {
        tmp = 'nd';
    } else if(number % 10 === 3 && number !== 13) {
        tmp = 'rd';
    } else {
        tmp = 'th';
    }
    
    return `${number}${tmp}`;
}

//reset day
setInterval(() => {
    data.globalStats.sentToday = 0;
    
    let guilds = Object.keys(data.timesSent);
    
    guilds.forEach(guild => {
        let members = Object.keys(data.timesSent[guild].members);
        
        data.timesSent[guild].serverStats.sentToday = 0;
        
        members.forEach(member => {
            data.timesSent[guild].members[member].sentToday = 0;
        });
    });
}, 86400000);

//reset week
setInterval(() => {
    data.globalStats.sentWeek = 0;
    
    let guilds = Object.keys(data.timesSent);
    
    guilds.forEach(guild => {
        let members = Object.keys(data.timesSent[guild].members);
        
        data.timesSent[guild].serverStats.sentWeek = 0;
        
        members.forEach(member => {
            data.timesSent[guild].members[member].sentWeek = 0;
        });
    });
}, 604800000);

/**
 * Create data if it doesn't exist.
 * @param userID {string} the ID of the user.
 * @param guildID {string} the ID of the guild.
 */
function createData(userID, guildID) {
    if(!data.timesSent[guildID]) {
        data.timesSent[guildID] = {
            serverStats: {
                sentToday: 0,
                sentWeek: 0,
                sentTotal: 0
            },
            members: {}
        };
        
    }
    
    if(!data.timesSent[guildID].members[userID]) {
        data.timesSent[guildID].members[userID] = {
            sentToday: 0,
            sentWeek: 0,
            sentTotal: 0
        };
    }
}

/**
 * Increment the eyes count
 * @param userID {string} the ID of the user.
 * @param guildID {string} the ID of the guild.
 */
function increment(userID, guildID) {
    //create the data if it does not exist.
    createData(userID, guildID);
    
    data.globalStats.sentToday++;
    data.globalStats.sentWeek++;
    data.globalStats.sentTotal++;
    
    data.timesSent[guildID].serverStats.sentToday++;
    data.timesSent[guildID].serverStats.sentWeek++;
    data.timesSent[guildID].serverStats.sentTotal++;
    
    data.timesSent[guildID].members[userID].sentToday++;
    data.timesSent[guildID].members[userID].sentWeek++;
    data.timesSent[guildID].members[userID].sentTotal++;
}

client.on("message", async (msg) => {
    if(msg.author.bot || msg.webhookID)
        return;
    
    if(msg.content.includes(eyes)) {
        console.log(`Eyes was sent.`);
        increment(msg.author.id, msg.guild.id);
        
        if(data.trackerChannels[msg.guild.id]) {
            const channel = await client.channels.fetch(data.trackerChannels[msg.guild.id].channel, true, false);
            if(channel) {
                if(channel.type !== "text")
                    return;
            
                let today = data.timesSent[msg.guild.id].members[msg.author.id].sentToday;
                let total = data.timesSent[msg.guild.id].members[msg.author.id].sentTotal;
            
                console.log(`today: ${today} total: ${total}`);
            
                channel.send(`${msg.author.username}#${msg.author.discriminator} has just sent ${eyes} for the ${getNumberEndingThing(today)} time today and the ${getNumberEndingThing(total)} time overall!`);
            
            }
        }
    }
    
});

client.ws.on("INTERACTION_CREATE", async (intr) => {
    console.log(JSON.stringify(intr, null, 4));
    
    switch(intr.data.name) {
        case "config": {
            //if user has "manage channels" permission
            if((intr.member.permissions & 16) === 16) {
                
                let channelID;
                
                intr.data.options.forEach(option => {
                    if(option.name === "channel")
                        channelID = option.value;
                    else
                        console.error(`unknown option ${option}`);
                });
                
                let channel = await client.channels.fetch(channelID, true, false);
                
                if(!channel || channel.type !== "text") {
                    return reply(intr.id, intr.token, `The channel <#${channel?.id}> is not a text channel or could not be found.`);
                }
                
                try {
                    await channel.send("Messages will be sent here.");
                } catch(e) {
                    return reply(intr.id, intr.token, `I cannot send messages to <#${channelID}>.  Please allow me view and send permissions for the channel or select a different channel.`);
                }
                
                if(!data.trackerChannels[intr.guild_id]) {
                    data.trackerChannels[intr.guild_id] = {
                        "channel": channel.id
                    };
                }
                return reply(intr.id, intr.token, `Successfully configured the bot to send messages to <#${channelID}>`);
            } else {
                return reply(intr.id, intr.token, "You must have the permission 'Manage Channels' to run this command.");
            }
        }
        case "stats": {
            let param = intr.data.options[0].options[0];
            
            if(param.name === "global") {
                
                let sent = data.globalStats;
                
                return reply(intr.id, intr.token, `Across ${client.guilds.cache.size} servers, the ${eyes} emoji has been sent:
\`\`\`
${sent.sentToday} time${plural(sent.sentToday)} today
${sent.sentWeek} time${plural(sent.sentWeek)} this week
${sent.sentTotal} time${plural(sent.sentTotal)} overall
\`\`\``);
                
            } else if(param.name === "server") {
                
                let sent = data.timesSent[intr.guild_id].serverStats;
                
                return reply(intr.id, intr.token, `In this server, the ${eyes} emoji has been sent:
\`\`\`
${sent.sentToday} time${plural(sent.sentToday)} today
${sent.sentWeek} time${plural(sent.sentWeek)} this week
${sent.sentTotal} time${plural(sent.sentTotal)} overall
\`\`\``);
                
            } else if(param.name === "individual") {
                
                let userToCheck = intr.member.user.id;
                
                if(param.options && param.options[0]?.name === "user") {
                    userToCheck = param.options[0].value;
                }
                
                createData(userToCheck, intr.guild_id);
                
                let sent = data.timesSent[intr.guild_id].members[userToCheck];
                
                let user = await client.users.fetch(userToCheck, true, false);
                
                if(!user)
                    return reply(intr.id, intr.token, "I can't seem to find that person :(");
                
                if(user.id === client.user.id)
                    return reply(intr.id, intr.token, `I have sent the ${eyes} emoji ${selfSent} times since I last went online.`);
                
                if(user.bot)
                    return reply(intr.id, intr.token, `uh... ${user.username}#${user.discriminator} is a bot ${eyes} I only track eyes sent from humans.`);
                
                return reply(intr.id, intr.token, `${intr.member.user.id === userToCheck
                    ? "You have"
                    :`${user.username}#${user.discriminator} has`} sent the ${eyes} emoji:
\`\`\`
${sent.sentToday} time${plural(sent.sentToday)} today
${sent.sentWeek} time${plural(sent.sentWeek)} this week
${sent.sentTotal} time${plural(sent.sentTotal)} overall
\`\`\``);
            } else {
                console.error(`Unknown option ${JSON.stringify(param)} for stats`);
                return reply(intr.id, intr.token, "There was an error, please contact the bot owner.");
            }
        }
        case "help": {
            return reply(intr.id, intr.token, "Eyes Tracker Bot.\n" +
                "This bot tracks the number of " + eyes + " emojis sent in your server.\n" +
                "\n\n" +
                "List of commands:\n" +
                "```\n" +
                "/config - set the channel where the eyes counter is sent\n" +
                "/disable - disable sending messages to the configured channel.\n" +
                "/stats - get statistics from all servers, this server, or a specific person.\n" +
                "/invite - generates an invite link to add this bot to another server.\n" +
                "```\n\n" +
                "Need help?  Join the support server here: https://discord.gg/RqksgVY2EA");
        }
        case "invite": {
            return reply(intr.id, intr.token, "[Here is an invite link for the bot](https://eyes.alexisok.dev/)");
        }
        case "disable": {
            if(data.trackerChannels[intr.guild_id] && data.trackerChannels[intr.guild_id].channel) {
                delete data.trackerChannels[intr.guild_id];
                return reply(intr.id, intr.token, "I have disabled the tracking channel.  You can re-enable it with /config");
            } else {
                return reply(intr.id, intr.token, "I could be mistaken, but it doesn't seem like you have a tracker channel set up yet.  Use `/config` to make one!");
            }
        }
    }
});

client.login(config.token);