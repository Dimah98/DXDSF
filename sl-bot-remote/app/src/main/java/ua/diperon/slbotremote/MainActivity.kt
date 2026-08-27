package ua.diperon.slbotremote

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import ua.diperon.slbotremote.ui.theme.MyApplicationTheme

/**
 * The main launch activity containing the core single NavHost for managing
 * the routing between our connection setups, the control dashboard, and the livestream console monitor.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Enforces full bleeds and respects status bar space safely
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme(darkTheme = true, dynamicColor = false) {
                // Setup NavController and container scaffolds
                val navController = rememberNavController()
                val sharedDashboardViewModel: DashboardViewModel = viewModel()

                NavHost(
                    navController = navController,
                    startDestination = "dashboard",
                    modifier = Modifier.fillMaxSize()
                ) {
                        // 1. Dashboard Screen route
                        composable("dashboard") {
                            DashboardScreen(
                                viewModel = sharedDashboardViewModel,
                                onNavigateToSettings = {
                                    navController.navigate("connection_settings")
                                },
                                onNavigateToProject = { projectName ->
                                    navController.navigate("project_monitor/$projectName")
                                },
                                onNavigateToNotifications = {
                                    navController.navigate("notifications")
                                },
                                onNavigateToAllInventories = {
                                    navController.navigate("all_inventories")
                                },
                                onNavigateToAllScreenshots = {
                                    navController.navigate("all_screenshots")
                                },
                                onNavigateToAllDeliveries = {
                                    navController.navigate("all_deliveries")
                                },
                                onNavigateToConfigs = {
                                    navController.navigate("config_manager")
                                },
                                onNavigateToMassScheduler = {
                                    navController.navigate("mass_scheduler")
                                },
                                onNavigateToVideoWall = {
                                    navController.navigate("video_wall")
                                }
                            )
                        }

                        // 2. Connections Settings screen route
                        composable("connection_settings") {
                            ConnectionSettingsScreen(
                                viewModel = sharedDashboardViewModel,
                                canGoBack = true,
                                onBackClick = {
                                    navController.popBackStack()
                                },
                                onSaveSuccess = {
                                    // Navigate back to Dashboard upon saving configs
                                    navController.popBackStack()
                                }
                            )
                        }

                        // 3. Project Monitor details console stream screen route
                        composable(
                            route = "project_monitor/{projectName}",
                            arguments = listOf(
                                navArgument("projectName") {
                                    type = NavType.StringType
                                }
                            )
                        ) { backStackEntry ->
                            val projectName = backStackEntry.arguments?.getString("projectName") ?: ""
                            val monitorViewModel: ProjectMonitorViewModel = viewModel()
                            ProjectMonitorScreen(
                                projectName = projectName,
                                viewModel = monitorViewModel,
                                onBackClick = {
                                    navController.popBackStack()
                                },
                                onNavigateToEditor = { pName ->
                                    navController.navigate("project_editor/$pName")
                                },
                                onNavigateToProject = { pName ->
                                    navController.navigate("project_monitor/$pName") {
                                        popUpTo("dashboard")
                                    }
                                },
                                onNavigateToInventory = { pName ->
                                    navController.navigate("inventory/$pName")
                                },
                                onNavigateToMap = { pName ->
                                     navController.navigate("island_map/$pName")
                                }
                            )
                        }

                        // 4. Notifications Screen route
                        composable("notifications") {
                            NotificationsScreen(
                                onBackClick = {
                                    navController.popBackStack()
                                }
                            )
                        }

                        // 7. Project Node Editor route
                        composable(
                            route = "project_editor/{projectName}",
                            arguments = listOf(
                                navArgument("projectName") {
                                    type = NavType.StringType
                                }
                            )
                        ) { backStackEntry ->
                            val projectName = backStackEntry.arguments?.getString("projectName") ?: ""
                            ProjectEditorScreen(
                                projectName = projectName,
                                apiService = sharedDashboardViewModel.getApiService(),
                                onBackClick = {
                                    navController.popBackStack()
                                }
                            )
                        }

                        // 8. Inventory Screen route
                        composable(
                            route = "inventory/{projectName}",
                            arguments = listOf(
                                navArgument("projectName") {
                                    type = NavType.StringType
                                }
                            )
                        ) { backStackEntry ->
                            val projectName = backStackEntry.arguments?.getString("projectName") ?: ""
                            val apiService = sharedDashboardViewModel.getApiService()
                            
                            if (apiService != null) {
                                InventoryScreen(
                                    projectName = projectName,
                                    apiService = apiService,
                                    onBackClick = {
                                        navController.popBackStack()
                                    }
                                )
                            } else {
                                // Fallback якщо apiService ще не ініціалізований
                                androidx.compose.foundation.layout.Box(
                                    modifier = androidx.compose.ui.Modifier.fillMaxSize(),
                                    contentAlignment = androidx.compose.ui.Alignment.Center
                                ) {
                                    androidx.compose.material3.Text("Завантаження...")
                                }
                            }
                        }

                        // 9. All Inventories Screen route
                        composable("all_inventories") {
                            val apiService = sharedDashboardViewModel.getApiService()
                            
                            if (apiService != null) {
                                AllInventoriesScreen(
                                    apiService = apiService,
                                    onBackClick = {
                                        navController.popBackStack()
                                    }
                                )
                            } else {
                                // Fallback якщо apiService ще не ініціалізований
                                androidx.compose.foundation.layout.Box(
                                    modifier = androidx.compose.ui.Modifier.fillMaxSize(),
                                    contentAlignment = androidx.compose.ui.Alignment.Center
                                ) {
                                    androidx.compose.material3.Text("Завантаження...")
                                }
                            }
                        }

                        // Island Map route
                        composable(
                            route = "island_map/{projectName}",
                            arguments = listOf(
                                navArgument("projectName") {
                                    type = NavType.StringType
                                }
                            )
                        ) { backStackEntry ->
                            val projectName = backStackEntry.arguments?.getString("projectName") ?: ""
                            val apiService = sharedDashboardViewModel.getApiService()
                            
                            if (apiService != null) {
                                IslandMapScreen(
                                    projectName = projectName,
                                    apiService = apiService,
                                    onBackClick = {
                                        navController.popBackStack()
                                    }
                                )
                            } else {
                                androidx.compose.foundation.layout.Box(
                                    modifier = androidx.compose.ui.Modifier.fillMaxSize(),
                                    contentAlignment = androidx.compose.ui.Alignment.Center
                                ) {
                                    androidx.compose.material3.Text("Завантаження...")
                                }
                            }
                        }

                        // 10. All Screenshots Screen route
                        composable("all_screenshots") {
                            val apiService = sharedDashboardViewModel.getApiService()
                            
                            if (apiService != null) {
                                AllScreenshotsScreen(
                                    apiService = apiService,
                                    onBackClick = {
                                        navController.popBackStack()
                                    }
                                )
                            } else {
                                androidx.compose.foundation.layout.Box(
                                    modifier = androidx.compose.ui.Modifier.fillMaxSize(),
                                    contentAlignment = androidx.compose.ui.Alignment.Center
                                ) {
                                    androidx.compose.material3.Text("Завантаження...")
                                }
                            }
                        }

                        // 11. All Deliveries Screen route
                        composable("all_deliveries") {
                            val apiService = sharedDashboardViewModel.getApiService()
                            
                            if (apiService != null) {
                                AllDeliveriesScreen(
                                    apiService = apiService,
                                    onBackClick = {
                                        navController.popBackStack()
                                    }
                                )
                            } else {
                                androidx.compose.foundation.layout.Box(
                                    modifier = androidx.compose.ui.Modifier.fillMaxSize(),
                                    contentAlignment = androidx.compose.ui.Alignment.Center
                                ) {
                                    androidx.compose.material3.Text("Завантаження...")
                                }
                            }
                        }

                        // 12. Config Manager Screen route
                        composable("config_manager") {
                            val apiService = sharedDashboardViewModel.getApiService()
                            
                            if (apiService != null) {
                                ConfigManagerScreen(
                                    apiService = apiService,
                                    onBackClick = {
                                        navController.popBackStack()
                                    }
                                )
                            } else {
                                androidx.compose.foundation.layout.Box(
                                    modifier = androidx.compose.ui.Modifier.fillMaxSize(),
                                    contentAlignment = androidx.compose.ui.Alignment.Center
                                ) {
                                    androidx.compose.material3.Text("Завантаження...")
                                }
                            }
                        }

                        // 13. Mass Scheduler Screen route
                        composable("mass_scheduler") {
                            val apiService = sharedDashboardViewModel.getApiService()
                            
                            if (apiService != null) {
                                MassSchedulerScreen(
                                    apiService = apiService,
                                    onBackClick = {
                                        navController.popBackStack()
                                    }
                                )
                            } else {
                                androidx.compose.foundation.layout.Box(
                                    modifier = androidx.compose.ui.Modifier.fillMaxSize(),
                                    contentAlignment = androidx.compose.ui.Alignment.Center
                                ) {
                                    androidx.compose.material3.Text("Завантаження...")
                                }
                            }
                        }

                        // 14. Multi-Stream Video Wall route
                        composable("video_wall") {
                            val multiStreamViewModel: MultiStreamViewModel = viewModel()
                            MultiStreamWallScreen(
                                viewModel = multiStreamViewModel,
                                apiService = sharedDashboardViewModel.getApiService(),
                                onBackClick = {
                                    navController.popBackStack()
                                },
                                onNavigateToMonitor = { projectName ->
                                    navController.navigate("project_monitor/$projectName")
                                }
                            )
                        }
                    }
                }
            }
        }
    }
