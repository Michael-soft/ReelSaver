package com.junkfood.seal.network

import com.tencent.mmkv.MMKV

/** Persisted configuration for connecting the app to a ReelSaver backend. */
object ReelSaverConfig {
    private const val KEY_BASE_URL = "reelsaver_base_url"
    private const val KEY_ENABLED = "reelsaver_sync_enabled"

    private val kv: MMKV by lazy { MMKV.defaultMMKV() }

    /** Base URL of the backend, e.g. "https://reelsaver.example.com". Empty = not configured. */
    var baseUrl: String
        get() = kv.decodeString(KEY_BASE_URL, "").orEmpty()
        set(value) = run { kv.encode(KEY_BASE_URL, normalizeUrl(value)) }

    /** Whether the user has opted into syncing with a backend account. */
    var syncEnabled: Boolean
        get() = kv.decodeBool(KEY_ENABLED, false)
        set(value) = run { kv.encode(KEY_ENABLED, value) }

    val isConfigured: Boolean
        get() = baseUrl.isNotBlank()

    private fun normalizeUrl(raw: String): String {
        val trimmed = raw.trim().trimEnd('/')
        if (trimmed.isEmpty()) return ""
        return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) trimmed
        else "https://$trimmed"
    }
}
