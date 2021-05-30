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

client.on("ready", async () => {
    console.log(`ready event`);
    commands.commandList.forEach((cm) => {
        client.api.applications(client.user.id)
              .commands.post({data: cm});
    });
    console.log(`posted`);
    
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

/**
 * Backup the data in case something happens to it.
 */
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
 * Clear the day statistics for all users and globally
 */
function clearDay() {
    
    //clear global day stats
    data.globalStats.sentToday = 0;
    
    let guilds = Object.keys(data.timesSent);
    
    //clear the day for each guild
    guilds.forEach(guild => {
        let members = Object.keys(data.timesSent[guild].members);
        
        data.timesSent[guild].serverStats.sentToday = 0;
        
        //for each member in guild who has data.
        members.forEach(member => {
            data.timesSent[guild].members[member].sentToday = 0;
        });
    });
    
    
    //set the timer for exactly one day from now.
    data.time.nextResetDay = Date.now() + 86400000;
}

/**
 * Clear the week statistics for all users and globally.
 */
function clearWeek() {
    data.globalStats.sentWeek = 0;
    
    let guilds = Object.keys(data.timesSent);
    
    //clear the week for each guild
    guilds.forEach(guild => {
        let members = Object.keys(data.timesSent[guild].members);
        
        data.timesSent[guild].serverStats.sentWeek = 0;
        
        //for each member in guild.
        members.forEach(member => {
            data.timesSent[guild].members[member].sentWeek = 0;
        });
    });
    
    //set the timer for exactly one week from now.
    data.time.nextResetWeek = Date.now() + 604800000;
}

//if the time clear does not exist, set a sample here.
if(!data.time) {
    data.time = {
        "nextResetDay": Date.now() + 180000,
        "nextResetWeek": Date.now() + 180000
    }
}

//check to see if things should be cleared every 10 seconds.
setInterval(() => {
    if(data.time.nextResetDay <= Date.now())
        clearDay();
    if(data.time.nextResetWeek <= Date.now())
        clearWeek();
}, 10000);

/**
 * Create data if it doesn't exist.
 * @param userID {string} the ID of the user.
 * @param guildID {string} the ID of the guild.
 */
function createData(userID, guildID) {
    
    //if the guild doesn't have data yet.
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
    
    //if the member doesn't have data yet.
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
 * @param amount {number} the amount to increment by.
 */
function increment(userID, guildID, amount) {
    //create the data if it does not exist.
    createData(userID, guildID);
    
    //global stats
    data.globalStats.sentToday += amount;
    data.globalStats.sentWeek += amount;
    data.globalStats.sentTotal += amount;
    
    //server stats
    data.timesSent[guildID].serverStats.sentToday += amount;
    data.timesSent[guildID].serverStats.sentWeek += amount;
    data.timesSent[guildID].serverStats.sentTotal += amount;
    
    //member stats
    data.timesSent[guildID].members[userID].sentToday += amount;
    data.timesSent[guildID].members[userID].sentWeek += amount;
    data.timesSent[guildID].members[userID].sentTotal += amount;
}

//test for eyes.
client.on("message", async (msg) => {
    
    //ignore bots (this could be disastrous)
    if(msg.author.bot || msg.webhookID)
        return;
    
    //if the message includes the eyes emoji
    if(msg.content.includes(eyes)) {
        
        //see how many eyes the user sent (up to 5 to avoid spam)
        let count = Math.min(msg.content.split(eyes).length - 1, 5);
        
        //increment the amount by 1 to 5 eyes.
        increment(msg.author.id, msg.guild.id, count);
        
        //if the guild has a tracker channel enabled.
        if(data.trackerChannels[msg.guild.id]) {
            
            //the channel to check.
            const channel = await client.channels.fetch(data.trackerChannels[msg.guild.id].channel, true, false);
            
            //if the channel does not exist, do not run (if it was deleted or denied permissions)
            if(channel) {
                if(channel.type !== "text")
                    return;
                
                //current amount the user sent to be displayed.
                let today = data.timesSent[msg.guild.id].members[msg.author.id].sentToday;
                let total = data.timesSent[msg.guild.id].members[msg.author.id].sentTotal;
                
                //send the message to the channel.
                channel.send(`${msg.author.username}#${msg.author.discriminator} has just sent ${count} ${eyes} emoji${plural(count)}, totaling ${(today)} today and ${(total)} overall!`);
                
            }
        }
    }
    
});

/**
 * Config command
 * @param intr the interaction.
 */
async function configCommand(intr) {
    //if user has "manage channels" permission
    if((intr.member.permissions & 16) === 16) {
        
        let channelID;
        
        //if other options are added, it'll be easy to build off of here.
        intr.data.options.forEach(option => {
            if(option.name === "channel")
                channelID = option.value;
            else
                console.error(`unknown option ${option}`);
        });
        
        //the channel to use
        let channel = await client.channels.fetch(channelID, true, false);
        
        //if the channel doesn't exist or isn't a text channel, check here.
        if(!channel || channel.type !== "text") {
            return reply(intr.id, intr.token, `The channel <#${channel?.id}> is not a text channel or could not be found.`);
        }
        
        //send a test message to see if the bot has access.
        try {
            await channel.send("Messages will be sent here.");
        } catch(e) {
            return reply(intr.id, intr.token, `I cannot send messages to <#${channelID}>.  Please allow me view and send permissions for the channel or select a different channel.`);
        }
        
        //set the channel
        if(!data.trackerChannels[intr.guild_id]) {
            data.trackerChannels[intr.guild_id] = {
                "channel": channel.id
            };
        }
        
        //reply
        return reply(intr.id, intr.token, `Successfully configured the bot to send messages to <#${channelID}>`);
    } else {
        return reply(intr.id, intr.token, "You must have the permission 'Manage Channels' to run this command.");
    }
}

/**
 * Get statistics on the amount of :eyes: emojis that have been sent.
 * 
 * Parameters:
 * - global
 * - server
 * - individual
 * \ - (opt) user
 * 
 * @param intr the interaction.
 */
async function statsCommand(intr) {
    
    //the first parameter
    let param = intr.data.options[0].options[0];
    
    //get the stats for all servers
    if(param.name === "global") {
        
        //pretty simple for global
        let sent = data.globalStats;
        
        //global stats message
        return reply(intr.id, intr.token, `Across ${client.guilds.cache.size} servers, the ${eyes} emoji has been sent:\n\`\`\`\n${sent.sentToday} time${plural(sent.sentToday)} today\n${sent.sentWeek} time${plural(sent.sentWeek)} this week\n${sent.sentTotal} time${plural(sent.sentTotal)} overall\n\`\`\``);
        
    }
    
    //get the stats for the current server.
    if(param.name === "server") {
        
        //server stats are pretty simple to get
        let sent = data.timesSent[intr.guild_id].serverStats;
        
        return reply(intr.id, intr.token, `In this server, the ${eyes} emoji has been sent:\n\`\`\`\n${sent.sentToday} time${plural(sent.sentToday)} today\n${sent.sentWeek} time${plural(sent.sentWeek)} this week\n${sent.sentTotal} time${plural(sent.sentTotal)} overall\n\`\`\``);
        
    }
    
    //get the stats for an individual user.
    if(param.name === "individual") {
        
        //let the user to check be the current user
        let userToCheck = intr.member.user.id;
        
        //if there is a user parameter, set the user to check here
        if(param.options && param.options[0]?.name === "user") {
            userToCheck = param.options[0].value;
        }
        
        //create the data if it doesn't exist to avoid errors.
        createData(userToCheck, intr.guild_id);
        
        //get the amount sent for this user in this server.
        let sent = data.timesSent[intr.guild_id].members[userToCheck];
        
        //get the actual user object here so people know who is being checked.
        let user = await client.users.fetch(userToCheck, true, false);
        
        //if the user doesn't exist (which is rare), check here.
        if(!user)
            return reply(intr.id, intr.token, "I can't seem to find that person :(");
        
        //if the user to check is this bot
        if(user.id === client.user.id)
            return reply(intr.id, intr.token, `I have sent the ${eyes} emoji ${selfSent} times since I last went online.`);
        
        //if the user is a different bot
        if(user.bot)
            return reply(intr.id, intr.token, `uh... ${user.username}#${user.discriminator} is a bot ${eyes} I only track eyes sent from humans.`);
        
        //send the message.
        return reply(intr.id, intr.token, `${intr.member.user.id === userToCheck
            ? "You have"
            : `${user.username}#${user.discriminator} has`} sent the ${eyes} emoji:\n\`\`\`\n${sent.sentToday} time${plural(sent.sentToday)} today\n${sent.sentWeek} time${plural(sent.sentWeek)} this week\n${sent.sentTotal} time${plural(sent.sentTotal)} overall\n\`\`\``);
    } else {
        console.error(`Unknown option ${JSON.stringify(param)} for stats`);
        return reply(intr.id, intr.token, "There was an error, please contact the bot owner.");
    }
}

/**
 * Give the user a help menu for the bot, as well
 * as an invite link to the bot support server.
 * 
 * @param intr the interaction.
 */
async function helpCommand(intr) {
    return reply(intr.id, intr.token, "Eyes Tracker Bot.\n" +
        "This bot tracks the number of " + eyes + " emojis sent in your server.\n" +
        "\n\n" +
        "List of commands:\n" +
        "```\n" +
        "/config - set the channel where the eyes counter is sent\n" +
        "/disable - disable sending messages to the configured channel.\n" +
        "/stats - get statistics from all servers, this server, or a specific person.\n" +
        "/invite - generates an invite link to add this bot to another server.\n" +
        "/time - get the time until the next reset.\n" +
        "```\n\n" +
        "Need help?  Join the support server: https://discord.gg/RqksgVY2EA");
}

/**
 * Disable the channel set in /config.
 * 
 * This does not have any arguments.
 * 
 * @param intr the interaction
 */
function disableCommand(intr) {
    if((intr.member.permissions & 16) === 16) {
        if(data.trackerChannels[intr.guild_id] && data.trackerChannels[intr.guild_id].channel) {
            delete data.trackerChannels[intr.guild_id];
            return reply(intr.id, intr.token, "I have disabled the tracking channel.  You can re-enable it with /config");
        } else {
            return reply(intr.id, intr.token, "I could be mistaken, but it doesn't seem like you have a tracker channel set up yet.  Use `/config` to make one!");
        }
    } else {
        return reply(intr.id, intr.token, "Sorry, but this command can only be run by someone who has the 'Manage Channels' permission.");
    }
}

/**
 * Get the time until the next day and week resets.
 * 
 * This does not have any arguments.
 * 
 * @param intr the interaction.
 */
function timeCommand(intr) {
    
    const moment = require("moment");
    
    let dayMS  = data.time.nextResetDay;
    let weekMS = data.time.nextResetWeek;
    
    const nextDayString  = `${new Date(dayMS).toString().split("GMT")[0]}MST (${moment(dayMS).fromNow()})`;
    const nextWeekString = `${new Date(weekMS).toString().split("GMT")[0]}MST (${moment(weekMS).fromNow()})`;
    
    return reply(intr.id, intr.token, `The daily and weekly counters will reset:\n\`\`\`\nDay  - ${nextDayString}\nWeek - ${nextWeekString}\n\`\`\``);
}

//on slash command.
client.ws.on("INTERACTION_CREATE", async (intr) => {
    
    //check to see what slash command was run.
    switch(intr.data.name) {
        case "config": {
            return configCommand(intr);
        }
        case "stats": {
            return statsCommand(intr);
        }
        case "help": {
            return helpCommand(intr);
        }
        case "invite": {
            return reply(intr.id, intr.token, "[Here is an invite link for the bot](https://eyes.alexisok.dev/)");
        }
        case "disable": {
            return disableCommand(intr);
        }
        case "time": {
            return timeCommand(intr);
        }
    }
});

//login
client.login(config.token);
