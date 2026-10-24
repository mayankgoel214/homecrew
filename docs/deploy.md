# Deploying HomeCrew

What's live: web on Vercel (https://homecrew-vt.vercel.app), API on Cloud Run in project `homecrew-vt`, region `us-east4`.

## One-time Google Cloud setup

```bash
P=homecrew-vt; R=us-east4; B=homecrew-vt-frames
SA=homecrew-api@$P.iam.gserviceaccount.com

gcloud projects create $P --name=HomeCrew
gcloud billing projects link $P --billing-account=<BILLING_ACCOUNT_ID>
gcloud config set project $P
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com storage.googleapis.com secretmanager.googleapis.com

# Database + 30-day auto-delete
gcloud firestore databases create --location=$R --type=firestore-native
gcloud firestore fields ttls update expire_at --collection-group=cases --enable-ttl --async

# Private photo bucket + 30-day auto-delete
gcloud storage buckets create gs://$B --location=$R --uniform-bucket-level-access --public-access-prevention
echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > /tmp/lifecycle.json
gcloud storage buckets update gs://$B --lifecycle-file=/tmp/lifecycle.json

# Least-privilege service account
gcloud iam service-accounts create homecrew-api --display-name="HomeCrew API (Cloud Run)"
gcloud projects add-iam-policy-binding $P --member=serviceAccount:$SA --role=roles/datastore.user --condition=None
gcloud storage buckets add-iam-policy-binding gs://$B --member=serviceAccount:$SA --role=roles/storage.objectAdmin

# Gemini key into Secret Manager (read from api/.env, never printed)
grep '^GEMINI_API_KEY=' api/.env | cut -d= -f2- | tr -d '\n' | \
  gcloud secrets create gemini-api-key --replication-policy=automatic --data-file=-
gcloud secrets add-iam-policy-binding gemini-api-key --member=serviceAccount:$SA \
  --role=roles/secretmanager.secretAccessor
```

## Deploy the API (every time the backend changes)

```bash
cd api
gcloud run deploy homecrew-api --source . --region us-east4 --project homecrew-vt \
  --service-account homecrew-api@homecrew-vt.iam.gserviceaccount.com \
  --set-env-vars STORE=firestore,GCP_PROJECT=homecrew-vt,GCS_BUCKET=homecrew-vt-frames,GEMMA_MODEL=gemma-4-31b-it \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --allow-unauthenticated --memory 512Mi --cpu 1 --timeout 300 --max-instances 3 --concurrency 40
```

API URL: https://homecrew-api-497983759327.us-east4.run.app (check `/health`).

## Deploy the web app (every time the frontend changes)

```bash
cd web
vercel deploy --prod --yes
# Re-point the short link at the new deployment:
vercel alias set <deployment-url-printed-above> homecrew-vt.vercel.app
```

`API_URL` is set in the Vercel project (Production) to the Cloud Run URL; `next.config.ts` rewrites `/api/*` to it.
Vercel Authentication is limited to preview deployments so the production URL is public.
The project's own production URL, https://homecrew-mayankgoel214s-projects.vercel.app, always follows the latest deploy.

## Notes
- Cloud quick tunnels (`trycloudflare.com`) buffer SSE; for phone testing against a local dev server use `ngrok http 3000`.
- Expected cost for the hackathon: about $0. Cloud Run scales to zero; Firestore, Storage and Secret Manager stay inside free usage at demo traffic.
