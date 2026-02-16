import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { SearchBar, Card, Badge, Button, Icon } from '@bolh/ui';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  category: string;
  rating: number;
  reviews: number;
  inStock: boolean;
}

const categories = ['All', 'Equipment', 'Uniforms', 'Training', 'Safety Gear'];

const products: Product[] = [
  {
    id: 1,
    name: 'Professional Body Armor',
    description: 'Level IIIA protection vest',
    price: 150000,
    originalPrice: 180000,
    imageUrl: '/images/armor.jpg',
    category: 'Safety Gear',
    rating: 4.8,
    reviews: 45,
    inStock: true,
  },
  {
    id: 2,
    name: 'Security Radio Set',
    description: 'Long-range walkie-talkie (pair)',
    price: 35000,
    imageUrl: '/images/radio.jpg',
    category: 'Equipment',
    rating: 4.5,
    reviews: 89,
    inStock: true,
  },
  {
    id: 3,
    name: 'Guard Uniform Set',
    description: 'Professional black uniform',
    price: 25000,
    imageUrl: '/images/uniform.jpg',
    category: 'Uniforms',
    rating: 4.7,
    reviews: 156,
    inStock: true,
  },
  {
    id: 4,
    name: 'First Aid Kit Pro',
    description: 'Complete emergency kit',
    price: 15000,
    imageUrl: '/images/firstaid.jpg',
    category: 'Safety Gear',
    rating: 4.9,
    reviews: 234,
    inStock: false,
  },
  {
    id: 5,
    name: 'Online Training Course',
    description: 'Professional guard certification',
    price: 50000,
    imageUrl: '/images/training.jpg',
    category: 'Training',
    rating: 4.6,
    reviews: 67,
    inStock: true,
  },
];

export default function MarketplacePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activeCategory, setActiveCategory] = createSignal('All');
  const [cartCount, setCartCount] = createSignal(0);

  const filteredProducts = () => {
    let filtered = products;
    
    if (activeCategory() !== 'All') {
      filtered = filtered.filter(p => p.category === activeCategory());
    }
    
    if (searchQuery()) {
      const query = searchQuery().toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const addToCart = (product: Product) => {
    setCartCount(cartCount() + 1);
    // TODO: Add to cart store
  };

  return (
    <div class="px-4 py-6 pb-20">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-gray-900">Marketplace</h1>
        <button 
          class="relative p-2"
          onClick={() => navigate('/cart')}
        >
          <Icon name="wallet" size="md" />
          <Show when={cartCount() > 0}>
            <span class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {cartCount()}
            </span>
          </Show>
        </button>
      </div>

      {/* Search */}
      <SearchBar
        placeholder="Search products..."
        value={searchQuery()}
        onChange={setSearchQuery}
        class="mb-4"
      />

      {/* Categories */}
      <div class="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 mb-4">
        <For each={categories}>
          {(category) => (
            <button
              onClick={() => setActiveCategory(category)}
              class={`
                px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                transition-colors duration-200
                ${activeCategory() === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              {category}
            </button>
          )}
        </For>
      </div>

      {/* Products grid */}
      <div class="grid grid-cols-2 gap-3">
        <For each={filteredProducts()}>
          {(product) => (
            <Card
              class="overflow-hidden cursor-pointer"
              onClick={() => navigate(`/marketplace/${product.id}`)}
            >
              {/* Image placeholder */}
              <div class="h-32 bg-gray-200 -mx-4 -mt-4 mb-3 flex items-center justify-center">
                <Icon name="camera" size="xl" class="text-gray-400" />
              </div>
              
              <div class="space-y-1">
                <h3 class="font-medium text-gray-900 text-sm line-clamp-2">
                  {product.name}
                </h3>
                
                <div class="flex items-center gap-1">
                  <Icon name="star" size="sm" class="text-yellow-400" />
                  <span class="text-xs text-gray-500">
                    {product.rating} ({product.reviews})
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <span class="font-bold text-blue-600">
                    {product.price.toLocaleString()} ₸
                  </span>
                  <Show when={product.originalPrice}>
                    <span class="text-xs text-gray-400 line-through">
                      {product.originalPrice?.toLocaleString()}
                    </span>
                  </Show>
                </div>

                <Show when={!product.inStock}>
                  <Badge variant="error" size="sm">Out of stock</Badge>
                </Show>
              </div>

              <Button
                variant={product.inStock ? 'primary' : 'secondary'}
                size="sm"
                fullWidth
                class="mt-3"
                disabled={!product.inStock}
                onClick={(e) => {
                  e.stopPropagation();
                  if (product.inStock) addToCart(product);
                }}
              >
                {product.inStock ? 'Add to Cart' : 'Out of Stock'}
              </Button>
            </Card>
          )}
        </For>
      </div>

      <Show when={filteredProducts().length === 0}>
        <div class="text-center py-12">
          <Icon name="search" size="xl" class="text-gray-300 mx-auto mb-2" />
          <p class="text-gray-500">No products found</p>
        </div>
      </Show>
    </div>
  );
}
