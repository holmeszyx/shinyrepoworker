# Project

This is a cloudflare Worker project which proxy a private Github repository as a personal maven repository.

# Architecture

Use nextjs (vinext) as infrastructure

Envrionments provider Github secure credentials:
`GITHUB_TOKEN`: Your generated Personal Access Token.
`GITHUB_OWNER`: Your GitHub username or organization name.
`GITHUB_REPO`: The name of your private repository.
