package com.example

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
import com.example.ui.theme.MyApplicationTheme

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

                NavHost(
                    navController = navController,
                    startDestination = "dashboard",
                    modifier = Modifier.fillMaxSize()
                ) {
                        // 1. Dashboard Screen route
                        composable("dashboard") {
                            val dashboardViewModel: DashboardViewModel = viewModel()
                            DashboardScreen(
                                viewModel = dashboardViewModel,
                                onNavigateToSettings = {
                                    navController.navigate("connection_settings")
                                },
                                onNavigateToProject = { projectName ->
                                    navController.navigate("project_monitor/$projectName")
                                },
                                onNavigateToSchedule = {
                                    navController.navigate("schedule")
                                },
                                onNavigateToStatistics = {
                                    navController.navigate("global_statistics")
                                },
                                onNavigateToNotifications = {
                                    navController.navigate("notifications")
                                },
                                onNavigateToAllInventories = {
                                    navController.navigate("all_inventories")
                                }
                            )
                        }

                        // 2. Connections Settings screen route
                        composable("connection_settings") {
                            val dashboardViewModel: DashboardViewModel = viewModel()
                            ConnectionSettingsScreen(
                                viewModel = dashboardViewModel,
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
                                }
                            )
                        }
                        
                        // 4. Schedule Screen route
                        composable("schedule") {
                            ScheduleScreen(
                                onBackClick = {
                                    navController.popBackStack()
                                }
                            )
                        }

                        // 5. Global Statistics Screen route
                        composable("global_statistics") {
                            GlobalStatisticsScreen(
                                onBackClick = {
                                    navController.popBackStack()
                                }
                            )
                        }

                        // 6. Notifications Screen route
                        composable("notifications") {
                            NotificationsScreen(
                                onBackClick = {
                                    navController.popBackStack()
                                }
                            )
                        }

                        // 7. Project Node Editor (WebView) route
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
                            val dashboardViewModel: DashboardViewModel = viewModel()
                            val apiService = dashboardViewModel.getApiService()
                            
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
                            val dashboardViewModel: DashboardViewModel = viewModel()
                            val apiService = dashboardViewModel.getApiService()
                            
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
                    }
                }
            }
        }
    }
