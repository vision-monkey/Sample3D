package com.example.hapticlab.viewmodel

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.example.hapticlab.AppContainer

object ViewModelFactories {
    fun home(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
        initializer { HomeViewModel(container.hapticEngine, container.preferences) }
    }

    fun detail(container: AppContainer, patternId: String): ViewModelProvider.Factory = viewModelFactory {
        initializer { DetailViewModel(patternId, container.hapticEngine, container.preferences) }
    }

    fun playground(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
        initializer { PlaygroundViewModel(container.hapticEngine) }
    }

    fun deviceInfo(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
        initializer { DeviceInfoViewModel(container.hapticEngine) }
    }
}
