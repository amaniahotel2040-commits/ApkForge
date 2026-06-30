package com.apkforge.template;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar loadingSpinner;
    private SwipeRefreshLayout swipeRefresh;
    private View noInternetView;
    private JSONObject appConfig;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        appConfig = loadConfig();
        setupWebView();
        applySettings();

        if (isNetworkAvailable()) {
            loadContent();
        } else {
            showNoInternet();
        }
    }

    // ---------------------------------------------------
    // Config (app_config.json) পড়া — ApkForge build সময় বসিয়ে দেয়
    // ---------------------------------------------------
    private JSONObject loadConfig() {
        try {
            InputStream is = getAssets().open("app_config.json");
            BufferedReader reader = new BufferedReader(new InputStreamReader(is));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            return new JSONObject(sb.toString());
        } catch (Exception e) {
            return new JSONObject(); // fallback empty config
        }
    }

    // ---------------------------------------------------
    // WebView Setup
    // ---------------------------------------------------
    private void setupWebView() {
        webView = findViewById(R.id.webview);
        loadingSpinner = findViewById(R.id.loading_spinner);
        swipeRefresh = findViewById(R.id.swipe_refresh);
        noInternetView = findViewById(R.id.no_internet_view);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        try {
            if (appConfig.optBoolean("mediaAutoplay", false)) {
                settings.setMediaPlaybackRequiresUserGesture(false);
            }
        } catch (Exception ignored) {}

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (loadingSpinner != null) loadingSpinner.setVisibility(View.GONE);
                if (swipeRefresh != null) swipeRefresh.setRefreshing(false);
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                if (!isNetworkAvailable()) {
                    showNoInternet();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // Pull to refresh
        if (swipeRefresh != null) {
            swipeRefresh.setOnRefreshListener(() -> {
                if (isNetworkAvailable()) {
                    webView.reload();
                } else {
                    swipeRefresh.setRefreshing(false);
                    showNoInternet();
                }
            });
        }

        // Retry button on no-internet screen
        Button retryBtn = findViewById(R.id.btn_retry);
        if (retryBtn != null) {
            retryBtn.setOnClickListener(v -> {
                if (isNetworkAvailable()) {
                    hideNoInternet();
                    loadContent();
                }
            });
        }
    }

    // ---------------------------------------------------
    // Settings (toggles) apply করা
    // ---------------------------------------------------
    private void applySettings() {
        try {
            if (appConfig.optBoolean("hideTitleBar", true)) {
                if (getSupportActionBar() != null) getSupportActionBar().hide();
            }
            if (appConfig.optBoolean("fullscreen", false)) {
                getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                );
            }
            if (swipeRefresh != null) {
                swipeRefresh.setEnabled(appConfig.optBoolean("pullToRefresh", true));
            }
        } catch (Exception ignored) {}
    }

    // ---------------------------------------------------
    // Content Load: URL mode বা local HTML mode
    // ---------------------------------------------------
    private void loadContent() {
        if (loadingSpinner != null && appConfig.optBoolean("loadingSpinner", true)) {
            loadingSpinner.setVisibility(View.VISIBLE);
        }

        try {
            String sourceType = appConfig.optString("sourceType", "url");
            if ("html".equals(sourceType)) {
                // local assets/index.html load হবে
                webView.loadUrl("file:///android_asset/index.html");
            } else {
                String url = appConfig.optString("websiteUrl", "");
                if (!url.isEmpty()) {
                    webView.loadUrl(url);
                }
            }
        } catch (Exception ignored) {}
    }

    // ---------------------------------------------------
    // Internet Check
    // ---------------------------------------------------
    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
        return caps != null && (
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
        );
    }

    private void showNoInternet() {
        if (noInternetView != null) noInternetView.setVisibility(View.VISIBLE);
        if (webView != null) webView.setVisibility(View.GONE);
        if (loadingSpinner != null) loadingSpinner.setVisibility(View.GONE);
    }

    private void hideNoInternet() {
        if (noInternetView != null) noInternetView.setVisibility(View.GONE);
        if (webView != null) webView.setVisibility(View.VISIBLE);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
