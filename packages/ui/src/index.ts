// Guardio UI Library
// Export all components, stores, and utilities

// Atoms
export { Button, type ButtonProps } from './components/atoms/Button';
export { Input, type InputProps } from './components/atoms/Input';
export { Badge, type BadgeProps } from './components/atoms/Badge';
export { Avatar, type AvatarProps } from './components/atoms/Avatar';
export { Icon, type IconProps } from './components/atoms/Icon';
export { Spinner } from './components/atoms/Spinner';

// Molecules
export { Card, type CardProps } from './components/molecules/Card';
export { ListItem, type ListItemProps } from './components/molecules/ListItem';
export { SearchBar, type SearchBarProps } from './components/molecules/SearchBar';
export { Rating, type RatingProps } from './components/molecules/Rating';

// Organisms
export { GuardCard, type GuardCardProps } from './components/organisms/GuardCard';
export { OrderCard, type OrderCardProps } from './components/organisms/OrderCard';
export { Header, type HeaderProps } from './components/organisms/Header';
export { BottomNav, type BottomNavProps, type NavItem } from './components/organisms/BottomNav';

// Stores
export { authStore, useAuth } from './stores/auth';
export { themeStore, useTheme } from './stores/theme';
export { locationStore, useLocation } from './stores/location';

// Styles
export { colors, spacing, typography, shadows } from './styles/tokens';

// ── Blockchain Components (shared between mobile & web) ──
export { WalletManager } from './components/blockchain/WalletManager';
export { BalanceDisplay } from './components/blockchain/BalanceDisplay';
export { TransactionForm } from './components/blockchain/TransactionForm';
export { ConsensusMonitor } from './components/blockchain/ConsensusMonitor';
export { TransactionHistory } from './components/blockchain/TransactionHistory';
export { Statistics } from './components/blockchain/Statistics';
export { BlockchainExplorer } from './components/blockchain/BlockchainExplorer';
export { BlockchainScreen } from './components/blockchain/BlockchainScreen';
export { ToastContainer, showToast } from './components/blockchain/Toast';
export type { ToastType } from './components/blockchain/Toast';
export { Spinner as BlockchainSpinner, LoadingOverlay, SkeletonLoader } from './components/blockchain/Spinner';
export { QRModal, QRButton } from './components/blockchain/QRModal';
export { PasswordPrompt } from './components/blockchain/PasswordPrompt';
export { BackupRestore } from './components/blockchain/BackupRestore';

// ── Shared Utilities ──
export { copyToClipboard } from './utils/clipboard';
export { encryptPrivateKey, decryptPrivateKey, isEncrypted } from './utils/keyEncryption';
export { generateSeedPhrase, validateSeedPhrase, seedToPrivateKey } from './utils/seedphrase';
export { estimateFees, formatFee, getFeeDescription } from './api/fees';

// ── Shared Types ──
export type { BlockchainStore } from './hooks/useBlockchain';
export type { WalletInfo, UTXO, ConsensusState, Transaction, TxRecord, TxResult, NetworkInfo, ChainStats, SmokeTestResult, SmokeTestStep } from './api/blockchain';
export type { FeeEstimate } from './api/fees';
