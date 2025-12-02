# Morphy's Token Onliner

![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![License](https://img.shields.io/github/license/MorpheusDark7/Token-Onliner)
![Status](https://img.shields.io/badge/status-active-brightgreen)
![Language](https://img.shields.io/badge/language-JavaScript-yellow)
![Stars](https://img.shields.io/github/stars/MorpheusDark7/Token-Onliner?style=social)

A Node.js 20 project that brings multiple Discord accounts online by connecting directly to the Discord Gateway.
It includes proper heartbeat handling, reconnection logic, presence customization, and safe rate-limited IDENTIFY staggering.

This is the modern rewrite of previous Node.js onliner tools—cleaned up, stable, and fully configurable through `config.json`.

---

## Features

* Fully correct Discord Gateway implementation
* Multi-token support with controlled identify delays
* Randomized status and activity selection
* Supports all activity types (game, streaming, listening, watching, custom, competing)
* Exponential backoff reconnection
* Direct WebSocket implementation (no outdated libraries)
* Configuration-based behavior

---

## Requirements

* **Node.js 20+**
* Install dependencies:

  ```bash
  npm install ws chalk
  ```

---

## Usage

### 1. Add Tokens

Create a `tokens.txt` file and place one token per line.

### 2. Configure Presence

Edit `config.json` to define:

* Online statuses
* Activity types
* Game names
* Listening / watching / custom statuses
* Streaming URLs

### 3. Run the Client

```bash
node gateway_presence.js
```

---

# Configuration (config.json)

*(To increase the chance of a value being selected, list it multiple times.)*

---

## Online Status Options

Valid values:

* `"online"`
* `"dnd"`
* `"idle"`
* `"invisible"`
* `"offline"`

Example:

```json5
"choose_random_online_status_from": [
  "online",
  "dnd",
  "idle"
]
```

---

## Activity Types

Valid values:

* `"game"`
* `"streaming"`
* `"listening"`
* `"watching"`
* `"custom"`
* `"competing"`

Example:

```json5
"choose_random_activity_type_from": [
  "game",
  "watching",
  "custom"
]
```

---

## Game Activity

```json5
"game": {
  "choose_random_game_from": [
    "Minecraft",
    "Rust",
    "VRChat"
  ]
}
```

---

## Streaming Activity

```json5
"streaming": {
  "choose_random_name_from": [
    "Fortnite",
    "Live Mix"
  ],
  "choose_random_url_from": [
    "https://www.twitch.tv/miyudevelopment",
    "https://www.youtube.com/watch?v=eSolTb0kIr0"
  ]
}
```

---

## Listening Activity

```json5
"listening": {
  "choose_random_name_from": [
    "Spotify",
    "Your Favorite Band"
  ]
}
```

---

## Watching Activity

```json5
"watching": {
  "choose_random_name_from": [
    "YouTube Videos",
    "Random Stream"
  ]
}
```

---

## Custom Status

```json5
"custom": {
  "choose_random_name_from": [
    "Custom Status 1",
    "Custom Status 2"
  ]
}
```

---

## Competing

```json5
"competing": {
  "choose_random_name_from": [
    "Gaming Tournament",
    "Coding Competition"
  ]
}
```

---

## Todo

* [ ] Add session resume logic
* [ ] Add randomized “system specs” per token
* [ ] Add presence rotation timer

---

## Dependencies

```bash
npm install ws chalk
```

---

## License

This project is licensed under the **GPL-3.0 License**.
See the `LICENSE` file for details.

---

## Disclaimer

This project uses Discord user tokens.
Automating user accounts violates Discord’s Terms of Service.
This project is for educational and research purposes only.
Use responsibly.

---

## Developed by Miyu Development

Author: **Morpheus Dark (@soulbinder9018)**

Website: [https://miyudevelopment.online](https://miyudevelopment.online)

Discord: [https://discord.com/invite/TXQ3wnPsSj](https://discord.com/invite/TXQ3wnPsSj)

