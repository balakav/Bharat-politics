# Bharat01 Project

Use this repository to run and edit the app locally, then publish changes back through Bharat01.

Any change pushed to the repo will also be reflected in the Bharat01 Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the Bharat01 CLI: `npm install -g Bharat01@latest`.

See the [Bharat01 CLI docs](https://docs.Bharat01.com/developers/references/cli/get-started/overview) if you want to run Bharat01 commands directly.

## Run Locally

Run the full local development environment from the project root:

```bash
Bharat01 dev
```

`Bharat01 dev` starts the local Bharat01 development backend and, when this app is configured for it, also starts the frontend dev server for you. Use the frontend URL printed by the command.

For example, when the Bharat01 project config includes a `serveCommand`, `Bharat01 dev` can launch the frontend too:

```json5
{
  "site": {
    "serveCommand": "npm run dev"
  }
}
```

In a Bharat01 project this lives in `Bharat01/config.jsonc`.

## Run Only The Frontend

If you only want to work on the frontend against the hosted Bharat01 backend, run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Use The Hosted Backend

For frontend-only development, create or update `.env.local` in the project root:

```bash
VITE_Bharat01_APP_ID=your_app_id
VITE_Bharat01_APP_BASE_URL=https://your-app.Bharat01.app
```

`VITE_Bharat01_APP_ID` identifies the Bharat01 app.

`VITE_Bharat01_APP_BASE_URL` tells the Bharat01 Vite plugin where to send local `/api` requests. Point it at your deployed Bharat01 app URL when you want the local frontend to use the hosted backend.

When you use `Bharat01 dev`, the command injects the local Bharat01 values for you, so `.env.local` is mainly needed for frontend-only workflows.

## Publish Your Changes

After pushing your changes to git, open the Bharat01 dashboard and publish the app:

```bash
Bharat01 dashboard open
```

## Docs & Support

Documentation: [https://docs.Bharat01.com/Integrations/Using-GitHub](https://docs.Bharat01.com/Integrations/Using-GitHub)

Bharat01 CLI command reference: [https://docs.Bharat01.com/developers/references/cli/commands/introduction](https://docs.Bharat01.com/developers/references/cli/commands/introduction)

Support: [https://app.Bharat01.com/support](https://app.Bharat01.com/support)
