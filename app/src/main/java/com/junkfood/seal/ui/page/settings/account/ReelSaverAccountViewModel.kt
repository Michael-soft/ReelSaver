package com.junkfood.seal.ui.page.settings.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.junkfood.seal.network.ApiResult
import com.junkfood.seal.network.ReelSaverAccountRepository
import com.junkfood.seal.network.ReelSaverConfig
import com.junkfood.seal.network.ReelStats
import com.junkfood.seal.network.ReelSaverApi
import com.junkfood.seal.network.ReelUser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ReelSaverAccountViewModel : ViewModel() {

    data class UiState(
        val baseUrl: String = ReelSaverConfig.baseUrl,
        val user: ReelUser? = ReelSaverAccountRepository.user.value,
        val stats: ReelStats? = null,
        val loading: Boolean = false,
        val error: String? = null,
        val registerMode: Boolean = false,
    )

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    init {
        if (ReelSaverConfig.isConfigured) refresh()
    }

    fun setBaseUrl(url: String) {
        _uiState.value = _uiState.value.copy(baseUrl = url)
    }

    fun saveBaseUrl() {
        ReelSaverConfig.baseUrl = _uiState.value.baseUrl
        _uiState.value = _uiState.value.copy(baseUrl = ReelSaverConfig.baseUrl, error = null)
        refresh()
    }

    fun toggleMode() {
        _uiState.value = _uiState.value.copy(registerMode = !_uiState.value.registerMode, error = null)
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            when (val res = ReelSaverAccountRepository.refresh()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(user = res.data, loading = false)
                    loadStats()
                }
                is ApiResult.Unauthorized ->
                    _uiState.value = _uiState.value.copy(user = null, loading = false)
                is ApiResult.Error ->
                    _uiState.value = _uiState.value.copy(loading = false, error = res.message)
            }
        }
    }

    fun submit(username: String, password: String, email: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            ReelSaverConfig.baseUrl = _uiState.value.baseUrl
            val res =
                if (_uiState.value.registerMode)
                    ReelSaverAccountRepository.register(username, password, email)
                else ReelSaverAccountRepository.login(username, password)
            when (res) {
                is ApiResult.Success -> {
                    ReelSaverConfig.syncEnabled = true
                    _uiState.value = _uiState.value.copy(user = res.data, loading = false)
                    loadStats()
                }
                is ApiResult.Unauthorized ->
                    _uiState.value =
                        _uiState.value.copy(loading = false, error = "Invalid credentials")
                is ApiResult.Error ->
                    _uiState.value = _uiState.value.copy(loading = false, error = res.message)
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            ReelSaverAccountRepository.logout()
            ReelSaverConfig.syncEnabled = false
            _uiState.value = _uiState.value.copy(user = null, stats = null)
        }
    }

    private fun loadStats() {
        viewModelScope.launch {
            when (val res = ReelSaverApi.stats()) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(stats = res.data)
                else -> {}
            }
        }
    }
}
