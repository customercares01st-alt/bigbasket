package com.customersupport.util

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log

/**
 * Opens the OEM-specific "Autostart" / "Background activity" settings screen.
 *
 * On Xiaomi, Oppo, Vivo, Huawei, Samsung and similar OEMs, background services
 * are killed unless the user explicitly whitelists the app. There is no public
 * API to change this — the best we can do is deep-link the user to the right
 * screen. On AOSP / devices without such a screen we fall back to app details.
 */
object OemSettingsHelper {

    private const val TAG = "OemSettingsHelper"

    private data class OemIntent(val pkg: String, val cls: String)

    /** Battery/autostart guidance for the detected device. */
    data class OemGuide(val oemName: String, val steps: List<String>)

    private val manufacturer: String get() = Build.MANUFACTURER.lowercase()

    private fun isXiaomi() = manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco")
    private fun isHuawei() = manufacturer.contains("huawei") || manufacturer.contains("honor")
    private fun isOppo() = manufacturer.contains("oppo") || manufacturer.contains("realme")
    private fun isVivo() = manufacturer.contains("vivo") || manufacturer.contains("iqoo")
    private fun isSamsung() = manufacturer.contains("samsung")
    private fun isOnePlus() = manufacturer.contains("oneplus")
    private fun isAsus() = manufacturer.contains("asus")
    private fun isLetv() = manufacturer.contains("letv") || manufacturer.contains("leeco")

    /**
     * Step-by-step battery whitelisting instructions for the current OEM.
     * The wording is intentionally generic enough to survive UI changes while
     * still naming the exact screens that matter.
     */
    fun getBatteryGuide(): OemGuide = when {
        isXiaomi() -> OemGuide(
            "Xiaomi / Redmi / POCO (MIUI)",
            listOf(
                "On the next screen, open Autostart and enable it for this app.",
                "Go to Settings → Battery → App battery saver → this app → choose \"No restrictions\".",
                "In the recent-apps view, tap and hold this app's card and lock it so it isn't cleared.",
                "Set Battery saver to \"Performance\" only if you still lose connection."
            )
        )
        isHuawei() -> OemGuide(
            "Huawei / Honor",
            listOf(
                "On the next screen, turn off \"Manage automatically\" for this app.",
                "Enable Auto-launch, Secondary launch, and Run in background.",
                "Go to Battery → More battery settings and disable \"Power-intensive prompt\".",
                "In the recent-apps view, lock this app so it isn't cleared."
            )
        )
        isOppo() -> OemGuide(
            "OPPO / Realme (ColorOS)",
            listOf(
                "On the next screen, allow Auto-start for this app.",
                "Go to Battery → this app and enable \"Allow background running\".",
                "Enable \"Allow auto-launch\" and \"Allow background activity\" if shown.",
                "In the recent-apps view, lock this app so it isn't cleared."
            )
        )
        isVivo() -> OemGuide(
            "Vivo / iQOO",
            listOf(
                "On the next screen, enable Autostart for this app.",
                "Go to Battery → Background power consumption management and allow this app.",
                "Turn off \"High background power consumption\" warnings for this app.",
                "In the recent-apps view, lock this app so it isn't cleared."
            )
        )
        isSamsung() -> OemGuide(
            "Samsung (One UI)",
            listOf(
                "Go to Settings → Battery → Background usage limits.",
                "Make sure this app is NOT in \"Sleeping apps\".",
                "Add this app to \"Never sleeping apps\".",
                "Open Settings → Apps → this app → Battery and choose \"Unrestricted\"."
            )
        )
        isOnePlus() -> OemGuide(
            "OnePlus (OxygenOS)",
            listOf(
                "On the next screen, enable Auto-launch for this app.",
                "Go to Battery → Battery optimization → this app → \"Don't optimize\".",
                "Set the app's battery usage to \"Allow background activity\"."
            )
        )
        isAsus() -> OemGuide(
            "ASUS",
            listOf(
                "Open Auto-start Manager and allow this app.",
                "Go to Power saver / Mobile Manager and allow background activity for this app.",
                "Disable any \"deep sleep\" or \"auto-deny\" option for this app."
            )
        )
        isLetv() -> OemGuide(
            "LeEco / Letv",
            listOf(
                "On the next screen, open Auto-boot management and allow this app.",
                "Allow this app to run in the background in battery settings."
            )
        )
        else -> OemGuide(
            "Android",
            listOf(
                "Open App info for this app and choose Battery → \"Unrestricted\" (or \"Don't optimize\").",
                "Allow background activity if the option is shown.",
                "If your phone has an Autostart or Startup manager, enable this app there too."
            )
        )
    }

    private val candidates: List<OemIntent> by lazy {
        when {
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") ||
                manufacturer.contains("poco") -> listOf(
                OemIntent("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
            )

            manufacturer.contains("huawei") || manufacturer.contains("honor") -> listOf(
                OemIntent("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
                OemIntent("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")
            )

            manufacturer.contains("oppo") || manufacturer.contains("realme") -> listOf(
                OemIntent("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
                OemIntent("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
                OemIntent("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity")
            )

            manufacturer.contains("vivo") || manufacturer.contains("iqoo") -> listOf(
                OemIntent("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
                OemIntent("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
                OemIntent("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")
            )

            manufacturer.contains("samsung") -> listOf(
                OemIntent("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"),
                OemIntent("com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity")
            )

            manufacturer.contains("oneplus") -> listOf(
                OemIntent("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity")
            )

            manufacturer.contains("asus") -> listOf(
                OemIntent("com.asus.mobilemanager", "com.asus.mobilemanager.powersaver.PowerSaverSettings")
            )

            manufacturer.contains("letv") || manufacturer.contains("leeco") -> listOf(
                OemIntent("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity")
            )

            else -> emptyList()
        }
    }

    /** @return true if an OEM-specific screen was opened. */
    fun openAutoStartSettings(context: Context): Boolean {
        for (candidate in candidates) {
            try {
                val intent = Intent().apply {
                    component = ComponentName(candidate.pkg, candidate.cls)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                if (context.packageManager.resolveActivity(intent, 0) != null) {
                    context.startActivity(intent)
                    Log.d(TAG, "Opened OEM autostart screen: ${candidate.cls}")
                    return true
                }
            } catch (e: Exception) {
                Log.w(TAG, "OEM autostart intent failed: ${candidate.cls}", e)
            }
        }
        return openAppDetails(context)
    }

    private fun openAppDetails(context: Context): Boolean {
        return try {
            context.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
            Log.d(TAG, "Opened app details as fallback")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open app details", e)
            false
        }
    }
}
