# Gitea Actions Setup Guide

This guide explains how to set up the automated build and deployment pipeline for your Homelab using Gitea Actions.

## 1. Enable Actions in Gitea

1. Go to your repository **Settings**.
2. Click on **Config**.
3. Check **Enable Actions**.
4. Click **Update Settings**.

## 2. Configure Runner (If not already set up)

Ensure you have a generic Gitea Runner registered for this repo or your user organization.
(If you are using the default `act_runner`, it should label itself as `ubuntu-latest` by default).

## 3. Add Secrets

Go to **Settings** > **Actions** > **Secrets** in your repository and add the following secrets:

| Secret Name | Description |
|-------------|-------------|
| `SSH_HOST` | The IP address or hostname of your homelab server. |
| `SSH_USER` | The username to SSH into your server (e.g., `root` or `ubuntu`). |
| `SSH_KEY` | The **Private Key** (content of `id_rsa`) for the SSH user. |
| `SSH_PORT` | (Optional) Your SSH port if not 22. |
| `DEPLOY_DIR` | (Optional) Directory path on server (Default: `~/docker/tab-sync-api`). |

> **Note**: The `GITHUB_TOKEN` is automatically provided by Gitea for registry authentication. You do NOT need to add it manually.

## 4. Server Setup (One-time)

On your homelab server, prepare the deployment directory:

1. SSH into your server.
2. Clone the repository to the target directory (e.g., `~/docker/tab-sync-api`):
   ```bash
   mkdir -p ~/docker
   cd ~/docker
   git clone https://your-gitea-url/username/tab-sync-api.git
   cd tab-sync-api
   ```
3. Create the production `.env` file:
   ```bash
   cp .env.production.example .env
   # Edit .env and set your secrets (JWT_SECRET, etc.)
   nano .env
   ```
4. **Important**: Verify permissions. The ssh user must have permission to run `docker` commands (add user to `docker` group).

## How it Works

1. **Push**: When you push code to `main` or `master`.
2. **Build**: Gitea Actions builds the Docker image and pushes it to your Gitea Container Registry (`/username/tab-sync-api:latest`).
3. **Deploy**: The workflow SSHs into your server, pulls the new image, and runs `docker compose up -d`.

### Troubleshooting

- **"Permission denied" during deploy**: Ensure the `SSH_KEY` public part is in `~/.ssh/authorized_keys` on the server.
- **"Login failed" for registry**: Ensure `Enable Packages` is checked in Repository Settings.
