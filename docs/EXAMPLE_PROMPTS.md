# Example Prompts

Here are some examples of how to prompt an LLM to use the telnet tools effectively:

**NOTE**: Some prompt smay include passwords. Do not include login credentials while working with a non-local LLM (Anthropic Claude, Google Gemini, OpenAI, etc.)

## Connecting to a MUD and Exploring

```
Connect to Aardwolf MUD at aardwolf.org port 4000 and help me explore as a guest. I've never played a MUD before, so explain the basic commands and what I'm seeing.
```

Claude will automatically set its identity first, then connect and guide you through the MUD environment.

## MUD Gaming Experience

```
Help me play Aardwolf MUD! 

1. Connect to aardwolf.org port 4000
2. When it asks for a name, enter "Guest"
3. I want to explore the newbie area and learn basic commands
4. Help me understand how combat works
5. Make sure to wait 2-3 seconds between commands - MUDs can be laggy
6. Enable continuous mode so we can have a flowing conversation

I've played D&D but never a MUD before, so explain things as we go. What should I try first?
```

## Advanced MUD Experience (Discworld MUD)

```
I'd like to explore Discworld MUD. Please:

1. Connect to discworld.starturtle.net port 4242
2. Create a new character for me to explore with
3. Use these parameters during character creation:
   - A human character
   - Focus on charisma and dexterity
   - Choose Ankh-Morpork as the starting city
4. Once in the game, help me learn basic navigation and game commands
5. Wait 2-3 seconds between commands to avoid flooding
6. Store any important locations or hints in connection memory

I've read some Discworld novels and want to experience the world firsthand!
```

## Network Equipment Access

```
I need to check on our old network monitoring system that only has telnet access (we're replacing it next month). Can you connect to 10.0.1.50 port 23 and:

1. Log in with username "netadmin"
2. Use password "[redacted]"
3. Run command "status all" to check the overall system health
4. Run "show alerts last 24h" to see recent problems
5. Take note of any critical alerts in the connection memory

The system runs an old proprietary OS, so standard Linux/Unix commands won't work.
```

## Game Character Creation with Memory

```
I want to create a character on Aardwolf MUD. Can you:

1. Connect to aardmud.org port 4000
2. Help me through the character creation process
3. Store my character details in connection memory
4. Guide me through the newbie area
5. Explain the game mechanics as we play

Let's create a spellcaster type character with a focus on intelligence.
```

## Legacy Equipment Access

```
I need to check the configuration on an old Cisco switch in our network closet. The previous admin left it with telnet access enabled (port 23). Can you:

1. Connect to 192.168.10.5 port 23
2. Log in with username "admin" and password "[redacted]"
3. Run "show running-config" and check if there are any security issues
4. Run "show interface status" to see which ports are active
5. Save the interface information to connection memory so we can reference it later

After we're done, I'll need to reconfigure it to disable telnet and use SSH only.
```

## Generic MUD Connection Template

```
Connect to [MUD NAME] at [HOST] port [PORT] and help me:

1. Log in [with username and password if needed]
2. Explore the environment using basic commands
3. Enable continuous mode for a better conversation flow
4. Wait [X] seconds between commands since this server might be laggy
5. Store important information in connection memory for reference

I'd like to [specific goal or experience]
```

## Remote System Management Template

```
I need help managing a legacy [SYSTEM TYPE] via telnet. Please:

1. Connect to [HOST] port [PORT]
2. Log in with username "[USERNAME]" and password "[PASSWORD]"
3. Run the following diagnostic commands:
   - [COMMAND 1]
   - [COMMAND 2]
   - [COMMAND 3]
4. Check for any errors or warnings in the output
5. Store the results in connection memory

The system uses [SPECIFIC DETAILS] command syntax.
```

## Mail Server Example

```
I need to check my mail server configuration. Please:

1. Connect to localhost port 25
2. Send the following SMTP commands to verify the server:
   - EHLO mycomputer.local
   - HELP
   - VRFY postmaster
3. Make note of any supported extensions or error messages
4. Check if the server supports STARTTLS

I'm trying to troubleshoot why mail delivery is failing from this server.
```
