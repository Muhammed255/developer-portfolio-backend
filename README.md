# developer-portfolio-backend

Contact-form email API for the portfolio site. Express 5 app that runs locally,
on Vercel (temporary) and on AWS Lambda behind an API Gateway HTTP API.

## Endpoints
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness check |
| POST | `/send-mail` | JSON `{ name, from, subject, body, website? }`. `website` is a honeypot and must stay empty. Limited to 3 requests per 15 minutes per IP. |

## Local development
```bash
cp .env.example .env   # fill in the SMTP credentials and MAIL_TO
npm install
npm run dev            # http://localhost:3000, restarts on change
npm test
npm run lint
```

## Environment variables
| Name | Required | Purpose |
|---|---|---|
| `MAIL_LOGIN_USER`, `MAIL_LOGIN_PASS` | yes | SMTP login credentials (Brevo by default) |
| `MAIL_TO` | yes | Comma-separated recipients |
| `CORS_ORIGINS` | yes in prod | Comma-separated allowed frontend origins (default `http://localhost:4200`) |
| `RATE_LIMIT_TABLE` | AWS only | DynamoDB table for the shared rate-limit counter; without it an in-memory counter is used |
| `NODE_ENV` | no | `development` disables rate limiting and returns error details |
| `MAIL_FROM` | no | Verified sender address (defaults to `MAIL_LOGIN_USER`; required for Brevo, whose login is not a sender) |
| `MAIL_HOST`, `MAIL_PORT` | no | Override the SMTP host (default `smtp-relay.brevo.com:465`) |
| `MAIL_SECRET_ID` | AWS only | Secrets Manager secret holding the `MAIL_*` keys as JSON; read at runtime and cached for 5 minutes |

## Layout
- `src/app.js` builds the Express app and exports it with no `listen` call.
- Entry points:
  - `src/local.js` for local development.
  - `src/lambda.js` for AWS Lambda.
  - `api/index.js` for Vercel.
- Helpers live in `helper/`: validation, mail, rate limiter, error handling and logging.

## Deploying to AWS (SAM)
One-time setup:
1. Install the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).
2. Create the mail secret in the region you deploy to:
   ```bash
   aws secretsmanager create-secret --name portfolio/contact-mail --region eu-central-1 \
     --secret-string '{"MAIL_LOGIN_USER":"...","MAIL_LOGIN_PASS":"...","MAIL_TO":"you@example.com","MAIL_FROM":"you@example.com"}'
   ```
   To change the credentials later, run `aws secretsmanager put-secret-value` with the new JSON. The function picks it up within 5 minutes, with no redeploy.
3. First deploy from your machine, reviewing the changeset:
   ```bash
   sam build && sam deploy
   ```
   Then copy the `ApiUrl` output into the frontend's `src/environments/environment.ts`.
4. (Optional) CI deploys: deploy `deploy/github-oidc-role.yaml` once:
   ```bash
   aws cloudformation deploy --template-file deploy/github-oidc-role.yaml \
     --stack-name portfolio-github-oidc --capabilities CAPABILITY_NAMED_IAM
   ```
   - Use `--parameter-overrides CreateOidcProvider=false` if the account already has GitHub's OIDC provider.
   - In the GitHub repo:
     - Store the `RoleArn` output as the `AWS_DEPLOY_ROLE_ARN` secret.
     - Set the variables `CORS_ORIGINS`, and optionally `AWS_REGION` and `ALARM_EMAIL`.
   - Pushes to `master` then lint, test and deploy.

Resources created:
- A Lambda function: Node 22, arm64, with 14-day log retention.
- An HTTP API throttled to 5 req/s with a burst of 10.
- A DynamoDB rate-limit table, on-demand billing, with TTL.
- Optionally, error alarms that email `AlarmEmail`.
