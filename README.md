# Click That 'Hood

![logo](public/images/logo.png?raw=)

## Give it a go

Clone this repository onto your local development machine:

- `git clone https://github.com/codeforgermany/click_that_hood.git`
- `cd click_that_hood`

Install dependencies:

- `npm i`

Build the `data.js` file:

- `npm run build`

The resulting site is entirely static and can be served with any HTTP server you like.
The server that is built into Python is a good way to get started.

- `cd public`
- `python -m http.server 8020`

Open it in a browser: <http://localhost:8020>

Traditionally the demo server has run on port 8020, but you can use any port you want. You may need to use 'python3' instead of 'python', depending on your local setup.
