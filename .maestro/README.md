# FitQuest E2E Tests — Maestro

## Setup

Install Maestro CLI:
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

## Running Tests

```bash
# Run all flows
maestro test .maestro/

# Run individual flow
maestro test .maestro/flow_onboarding.yaml
maestro test .maestro/flow_workout_completion.yaml
maestro test .maestro/flow_cold_launch_dashboard.yaml
```

## Prerequisites
- Android emulator or device with FitQuest dev build installed
- `adb devices` shows connected device
- App package: `com.hugelet.fitquest`

## CI Integration
```yaml
# In GitHub Actions:
- name: Run E2E tests
  uses: mobile-dev-inc/action-maestro-cloud@v1
  with:
    api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
    app-file: app-release.apk
```
