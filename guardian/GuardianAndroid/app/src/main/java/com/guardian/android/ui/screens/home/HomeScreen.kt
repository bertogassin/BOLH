package com.guardian.android.ui.screens.home

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.guardian.android.data.api.OrderListItem
import com.guardian.android.data.models.Bid
import com.guardian.android.data.models.Order
import com.guardian.android.data.models.User
import com.guardian.android.data.models.UserType

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onNavigateToCreateOrder: () -> Unit,
    onNavigateToOrderDetail: (String) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Home") },
                actions = {
                    IconButton(onClick = { }) {
                        BadgedBox(
                            badge = {
                                if (viewModel.unreadCount > 0) {
                                    Badge { Text(viewModel.unreadCount.toString()) }
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = "Notifications"
                            )
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNavigateToCreateOrder,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "New order"
                )
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(16.dp)
        ) {
            item {
                Text(
                    text = "да я могу тут написать",
                    style = MaterialTheme.typography.headlineSmall
                )
            }
            item {
                GreetingHeader(user = viewModel.currentUser)
            }
            item {
                QuickActionsGrid(
                    onCreateOrder = onNavigateToCreateOrder,
                    onMyOrders = { },
                    onPayments = { },
                    onChats = { }
                )
            }
            if (viewModel.userType == UserType.CLIENT) {
                item {
                    ActiveOrdersSectionApi(
                        orders = viewModel.apiOrders,
                        onOrderClick = onNavigateToOrderDetail
                    )
                }
            }
        }
    }
}

@Composable
fun GreetingHeader(user: User?) {
    val greeting = when (java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)) {
        in 0..11 -> "Good morning"
        in 12..17 -> "Good afternoon"
        else -> "Good evening"
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                "$greeting,",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                user?.firstName ?: "Loading...",
                style = MaterialTheme.typography.titleLarge
            )
        }
    }
}

@Composable
fun QuickActionsGrid(
    onCreateOrder: () -> Unit,
    onMyOrders: () -> Unit,
    onPayments: () -> Unit,
    onChats: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        QuickActionButton(
            icon = Icons.Default.Add,
            title = "New order",
            color = MaterialTheme.colorScheme.primary,
            onClick = onCreateOrder,
            modifier = Modifier.weight(1f)
        )
        QuickActionButton(
            icon = Icons.Default.Menu,
            title = "My orders",
            color = Color(0xFFAF52DE),
            onClick = onMyOrders,
            modifier = Modifier.weight(1f)
        )
        QuickActionButton(
            icon = Icons.Default.Settings,
            title = "Payments",
            color = MaterialTheme.colorScheme.tertiary,
            onClick = onPayments,
            modifier = Modifier.weight(1f)
        )
        QuickActionButton(
            icon = Icons.Default.Email,
            title = "Chats",
            color = Color(0xFFFF9500),
            onClick = onChats,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
fun QuickActionButton(
    icon: ImageVector,
    title: String,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(
            color = color,
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.size(48.dp),
            onClick = onClick
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = Color.White
                )
            }
        }
        Text(
            text = title,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
fun ActiveOrdersSection(
    orders: List<Order>,
    onOrderClick: (String) -> Unit
) {
    Column {
        Text("Active orders", style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(8.dp))
        if (orders.isEmpty()) {
            Text("No active orders", color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            orders.forEach { order ->
                Card(
                    onClick = { onOrderClick(order.id.toString()) },
                    modifier = Modifier.padding(vertical = 4.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(order.title, style = MaterialTheme.typography.titleSmall)
                        Text(order.status.displayName, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
fun ActiveOrdersSectionApi(
    orders: List<OrderListItem>,
    onOrderClick: (String) -> Unit
) {
    Column {
        Text("My orders", style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(8.dp))
        if (orders.isEmpty()) {
            Text("No orders", color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            orders.forEach { order ->
                Card(
                    onClick = { onOrderClick(order.id) },
                    modifier = Modifier.padding(vertical = 4.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(order.title, style = MaterialTheme.typography.titleSmall)
                        Text(order.status, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}
