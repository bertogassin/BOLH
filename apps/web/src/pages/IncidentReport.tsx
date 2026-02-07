import { createSignal } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { Card, Button, Input, Icon, Badge } from '@guardio/ui';

const incidentTypes = [
  { id: 'suspicious_activity', label: 'Suspicious Activity', icon: 'search' },
  { id: 'unauthorized_access', label: 'Unauthorized Access', icon: 'shield' },
  { id: 'safety_hazard', label: 'Safety Hazard', icon: 'sos' },
  { id: 'medical_emergency', label: 'Medical Emergency', icon: 'heart' },
  { id: 'property_damage', label: 'Property Damage', icon: 'home' },
  { id: 'other', label: 'Other', icon: 'chat' },
];

const severityLevels = [
  { id: 'low', label: 'Low', color: 'bg-gray-500' },
  { id: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { id: 'high', label: 'High', color: 'bg-orange-500' },
  { id: 'critical', label: 'Critical', color: 'bg-red-500' },
];

export default function IncidentReportPage() {
  const navigate = useNavigate();
  const params = useParams();
  
  const [selectedType, setSelectedType] = createSignal('');
  const [severity, setSeverity] = createSignal('medium');
  const [description, setDescription] = createSignal('');
  const [location, setLocation] = createSignal('');
  const [photos, setPhotos] = createSignal<string[]>([]);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const handleAddPhoto = () => {
    // TODO: Implement camera/gallery picker
    setPhotos([...photos(), `photo_${photos().length + 1}`]);
  };

  const handleSubmit = async () => {
    if (!selectedType() || !description()) return;
    
    setIsSubmitting(true);
    try {
      // TODO: Submit report via API
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigate('/orders/' + params.orderId);
    } catch (error) {
      console.error('Failed to submit report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="px-4 py-6 pb-24">
      {/* Header */}
      <div class="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" size="md" />
        </button>
        <h1 class="text-xl font-bold text-gray-900">Incident Report</h1>
      </div>

      {/* Incident type */}
      <section class="mb-6">
        <h2 class="text-sm font-medium text-gray-700 mb-3">Incident Type</h2>
        <div class="grid grid-cols-2 gap-3">
          {incidentTypes.map(type => (
            <button
              onClick={() => setSelectedType(type.id)}
              class={`
                p-4 rounded-xl border-2 text-left transition-all
                ${selectedType() === type.id
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <Icon
                name={type.icon}
                size="md"
                class={selectedType() === type.id ? 'text-red-600' : 'text-gray-400'}
              />
              <p class="font-medium text-gray-900 mt-2 text-sm">{type.label}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Severity */}
      <section class="mb-6">
        <h2 class="text-sm font-medium text-gray-700 mb-3">Severity Level</h2>
        <div class="flex gap-2">
          {severityLevels.map(level => (
            <button
              onClick={() => setSeverity(level.id)}
              class={`
                flex-1 py-3 rounded-xl border-2 text-center transition-all
                ${severity() === level.id
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600'
                }
              `}
            >
              <div class={`w-3 h-3 ${level.color} rounded-full mx-auto mb-1`} />
              <span class="text-sm">{level.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Location */}
      <section class="mb-6">
        <Input
          label="Location"
          placeholder="Where did the incident occur?"
          value={location()}
          onInput={(e) => setLocation(e.currentTarget.value)}
          leftIcon={<Icon name="location" size="sm" />}
          fullWidth
        />
      </section>

      {/* Description */}
      <section class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          placeholder="Describe the incident in detail..."
          rows={4}
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </section>

      {/* Photos */}
      <section class="mb-6">
        <h2 class="text-sm font-medium text-gray-700 mb-3">Photos (optional)</h2>
        <div class="flex gap-3 overflow-x-auto pb-2">
          <button
            onClick={handleAddPhoto}
            class="w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center flex-shrink-0"
          >
            <Icon name="camera" size="lg" class="text-gray-400" />
          </button>
          {photos().map((_, index) => (
            <div class="w-20 h-20 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
              <span class="text-sm text-gray-500">Photo {index + 1}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Submit button */}
      <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-area-inset-bottom">
        <Button
          variant="danger"
          size="lg"
          fullWidth
          loading={isSubmitting()}
          disabled={!selectedType() || !description()}
          onClick={handleSubmit}
        >
          Submit Report
        </Button>
      </div>
    </div>
  );
}
