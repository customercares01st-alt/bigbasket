package com.customersupport

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.customersupport.databinding.ActivityOemGuideBinding
import com.customersupport.util.OemSettingsHelper

/**
 * Native, offline screen with OEM-specific battery-whitelisting instructions.
 * Shown once after the user grants the battery-optimization exemption.
 */
class OemGuideActivity : AppCompatActivity() {

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

        binding.openSettingsButton.setOnClickListener {
            OemSettingsHelper.openAutoStartSettings(this)
        }
        binding.doneButton.setOnClickListener { finish() }
    }
}
