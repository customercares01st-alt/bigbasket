package com.customersupport

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.customersupport.databinding.ActivityOemGuideBinding
import com.customersupport.util.OemSettingsHelper

/**
 * Native, offline screen that guides the user through the two background
 * requirements: the battery-optimization exemption and OEM autostart.
 *
 * The user taps to trigger the system dialog / OEM settings screen — the app
 * never jumps straight into Settings on its own.
 */
class OemGuideActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "OemGuideActivity"
    }

    private lateinit var binding: ActivityOemGuideBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOemGuideBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val guide = OemSettingsHelper.getBatteryGuide()
        binding.introText.text = getString(R.string.oem_guide_intro, guide.oemName)
        binding.stepsText.text = guide.steps
            .mapIndexed { index, step -> "${index + 1}.  $step" }
            .joinToString("\n\n")

        binding.grantBatteryButton.setOnClickListener { requestBatteryExemption() }
        binding.openSettingsButton.setOnClickListener {
            OemSettingsHelper.openAutoStartSettings(this)
        }
        binding.doneButton.setOnClickListener { finish() }

        updateBatteryState()
    }

    override fun onResume() {
        super.onResume()
        // User may have granted the exemption in the system dialog.
        updateBatteryState()
    }

    private fun updateBatteryState() {
        if (isIgnoringBatteryOptimizations()) {
            binding.batteryStatusText.text = getString(R.string.oem_guide_battery_allowed)
            binding.grantBatteryButton.visibility = View.GONE
        } else {
            binding.batteryStatusText.text = getString(R.string.oem_guide_battery_needed)
            binding.grantBatteryButton.visibility = View.VISIBLE
        }
    }

    private fun isIgnoringBatteryOptimizations(): Boolean {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(packageName)
    }

    /**
     * Show the system "ignore battery optimizations" confirmation dialog.
     * Devices whose OEM removed the dialog fall back to the battery settings list.
     */
    @SuppressLint("BatteryLife")
    private fun requestBatteryExemption() {
        try {
            startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "Battery exemption dialog unavailable, opening settings list", e)
            try {
                startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            } catch (e2: Exception) {
                Log.e(TAG, "Failed to open battery settings", e2)
            }
        }
    }
}
