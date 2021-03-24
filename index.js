const Discord = require('discord.js');
const client = new Discord.Client();

// Configure environment vairables
const dotenv = require('dotenv');
dotenv.config();

const announcement_user = 'Placeholder';

client.on('ready', () => {
	console.log(`Logged in as ${client.user.id}!`);
	console.log('New welcome message!');
});

client.on('message', msg => {
	if (msg.author.id != client.user.id) {
		msg.reply(`You said ${msg.content}`);
	}

});

// console.log()
client.login(process.env.TOKEN);