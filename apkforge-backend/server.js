// ApkForge Backend Server
// কাজ: ওয়েবসাইট থেকে app data নিয়ে, GitHub-এ পাঠিয়ে APK build trigger করা

const express = require('express');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' })); // HTML file বড় হতে পারে তাই limit বাড়ানো

const PORT = process.env.PORT || 3000;

// GitHub Token environment variable থেকে আসবে (Railway dashboard-এ set করতে হবে)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;       // তোমার GitHub username
const GITHUB_REPO = process.env.GITHUB_REPO;         // template repo-র নাম
const WORKFLOW_FILE = 'build-apk.yml';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ---------------------------------------------
// Health check - Railway এটা দিয়ে check করে server চালু আছে কিনা
// ---------------------------------------------
app.get('/', (req, res) => {
  res.json({ status: 'ApkForge backend চালু আছে ✅' });
});

// ---------------------------------------------
// MAIN ROUTE: APK Build Request
// Frontend থেকে app info আসবে এখানে
// ---------------------------------------------
app.post('/api/build', async (req, res) => {
  try {
    const {
      appName,
      packageName,
      sourceType,      // "url" অথবা "html"
      websiteUrl,      // sourceType=url হলে
      htmlContent,     // sourceType=html হলে (base64 বা raw string)
      versionName,
      versionCode,
      statusBarColor,
      appIconBase64,
      splashLogoBase64,
      splashBgColor,
      brandingText,
      settings         // { hideTitleBar, fullscreen, loadingSpinner, ... }
    } = req.body;

    // ---- Basic validation ----
    if (!appName || !packageName) {
      return res.status(400).json({ error: 'App Name এবং Package Name দরকার' });
    }
    if (sourceType === 'url' && !websiteUrl) {
      return res.status(400).json({ error: 'Website URL দরকার' });
    }
    if (sourceType === 'html' && !htmlContent) {
      return res.status(400).json({ error: 'HTML ফাইল দরকার' });
    }

    // ---- Unique build ID তৈরি (project track করার জন্য) ----
    const buildId = `build_${Date.now()}`;

    // ---- GitHub repository_dispatch event পাঠানো ----
    // এটা GitHub Actions workflow শুরু করে দেবে
    await octokit.repos.createDispatchEvent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      event_type: 'build_apk',
      client_payload: {
        build_id: buildId,
        app_name: appName,
        package_name: packageName,
        source_type: sourceType,
        website_url: websiteUrl || '',
        html_content: htmlContent || '',
        version_name: versionName || '1.0',
        version_code: versionCode || '1',
        status_bar_color: statusBarColor || '#e0282e',
        app_icon: appIconBase64 || '',
        splash_logo: splashLogoBase64 || '',
        splash_bg_color: splashBgColor || '#0b0b0e',
        branding_text: brandingText || '',
        settings: JSON.stringify(settings || {})
      }
    });

    res.json({
      success: true,
      buildId,
      message: 'Build শুরু হয়েছে। সাধারণত ৩-৫ মিনিট সময় লাগে।'
    });

  } catch (err) {
    console.error('Build trigger error:', err);
    res.status(500).json({ error: 'Build শুরু করতে সমস্যা হয়েছে', details: err.message });
  }
});

// ---------------------------------------------
// BUILD STATUS CHECK
// Frontend এই route দিয়ে check করবে build শেষ হয়েছে কিনা
// ---------------------------------------------
app.get('/api/status/:buildId', async (req, res) => {
  try {
    const { buildId } = req.params;

    // GitHub Actions-এর latest workflow runs দেখা
    const runs = await octokit.actions.listWorkflowRuns({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      workflow_id: WORKFLOW_FILE,
      per_page: 10
    });

    // buildId ম্যাচ করা run খুঁজে বের করা (run name-এ buildId থাকবে)
    const matchedRun = runs.data.workflow_runs.find(run =>
      run.name && run.name.includes(buildId)
    );

    if (!matchedRun) {
      return res.json({ status: 'pending', message: 'Build এখনো শুরু হচ্ছে...' });
    }

    if (matchedRun.status === 'completed') {
      if (matchedRun.conclusion === 'success') {
        // APK download link বের করা (artifact থেকে)
        const artifacts = await octokit.actions.listWorkflowRunArtifacts({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          run_id: matchedRun.id
        });

        const apkArtifact = artifacts.data.artifacts.find(a => a.name.includes('apk'));

        return res.json({
          status: 'success',
          downloadUrl: apkArtifact ? apkArtifact.archive_download_url : null,
          message: 'APK তৈরি হয়ে গেছে! ✅'
        });
      } else {
        return res.json({
          status: 'failed',
          message: 'Build fail হয়েছে। আবার চেষ্টা করো।'
        });
      }
    }

    return res.json({ status: 'building', message: 'APK build হচ্ছে...' });

  } catch (err) {
    console.error('Status check error:', err);
    res.status(500).json({ error: 'Status check করতে সমস্যা', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ApkForge backend চালু হয়েছে: http://localhost:${PORT}`);
});
