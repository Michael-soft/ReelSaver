package com.junkfood.seal.network

import com.tencent.mmkv.MMKV
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

/**
 * Minimal cookie jar backed by MMKV so the Flask session cookie survives app
 * restarts. Cookies are stored per host and expired entries are dropped on read.
 */
class PersistentCookieJar : CookieJar {

    @Serializable
    private data class StoredCookie(
        val name: String,
        val value: String,
        val expiresAt: Long,
        val domain: String,
        val path: String,
        val secure: Boolean,
        val httpOnly: Boolean,
        val hostOnly: Boolean,
    )

    private val kv: MMKV by lazy { MMKV.mmkvWithID("reelsaver_cookies") }
    private val json = Json { ignoreUnknownKeys = true }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        if (cookies.isEmpty()) return
        val existing = load(url.host).associateBy { it.name }.toMutableMap()
        for (c in cookies) {
            existing[c.name] =
                StoredCookie(
                    name = c.name,
                    value = c.value,
                    expiresAt = c.expiresAt,
                    domain = c.domain,
                    path = c.path,
                    secure = c.secure,
                    httpOnly = c.httpOnly,
                    hostOnly = c.hostOnly,
                )
        }
        kv.encode(url.host, json.encodeToString(existing.values.toList()))
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        return load(url.host)
            .filter { it.expiresAt > now }
            .mapNotNull { stored ->
                Cookie.Builder()
                    .name(stored.name)
                    .value(stored.value)
                    .apply {
                        if (stored.hostOnly) hostOnlyDomain(stored.domain)
                        else domain(stored.domain)
                    }
                    .path(stored.path)
                    .expiresAt(stored.expiresAt)
                    .apply {
                        if (stored.secure) secure()
                        if (stored.httpOnly) httpOnly()
                    }
                    .build()
            }
    }

    fun clear() = kv.clearAll()

    private fun load(host: String): List<StoredCookie> {
        val raw = kv.decodeString(host, "").orEmpty()
        if (raw.isBlank()) return emptyList()
        return runCatching { json.decodeFromString<List<StoredCookie>>(raw) }.getOrDefault(emptyList())
    }
}
