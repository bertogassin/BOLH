package com.guardian.android.data.prefs

import android.content.Context
import android.content.SharedPreferences

class TokenStore(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("guardian_android", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_TOKEN, value).apply()
        }

    fun clear() {
        prefs.edit().remove(KEY_TOKEN).apply()
    }

    companion object {
        private const val KEY_TOKEN = "token"
    }
}
