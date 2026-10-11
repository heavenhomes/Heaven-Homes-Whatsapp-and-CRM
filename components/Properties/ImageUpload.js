"use client";
import toast from 'react-hot-toast';

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function ImageUpload({ images = [], onImagesChange, uploading, setUploading }) {
  const handleImageChange = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selectedFiles.length) return;

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      toast.error(`A property can have up to ${MAX_IMAGES} photos`);
      return;
    }

    const validFiles = selectedFiles.filter((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}: Please upload an image file`);
        return false;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`${file.name}: Image size should be less than 5MB`);
        return false;
      }
      return true;
    });

    if (selectedFiles.length > remainingSlots) {
      toast.error(`You can upload ${remainingSlots} more photo${remainingSlots === 1 ? '' : 's'}`);
    }
    const filesToUpload = validFiles.slice(0, remainingSlots);
    if (!filesToUpload.length) {
      return;
    }

    setUploading(true);

    try {
      let uploadedCount = 0;
      let updatedImages = [...images];
      for (const file of filesToUpload) {
        const body = new FormData();
        body.append('image', file);

        try {
          const response = await fetch('/api/upload', { method: 'POST', body });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to upload image');
          }

          updatedImages = [...updatedImages, { url: data.url, publicId: data.publicId || '' }];
          onImagesChange(updatedImages);
          uploadedCount += 1;
        } catch (error) {
          console.error('Error uploading image:', error);
          toast.error(`${file.name}: ${error.message || 'Error uploading image'}`);
        }
      }

      if (uploadedCount) {
        toast.success(`${uploadedCount} photo${uploadedCount === 1 ? '' : 's'} uploaded successfully`);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Property Images ({images.length}/{MAX_IMAGES})
      </label>

      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="flex flex-wrap gap-3">
          {images.map((image, index) => (
            <div key={image.publicId || image.url || index} className="relative group">
              <img
                src={image.url}
                alt={`Property photo ${index + 1}`}
                className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm"
              />
              <button
                type="button"
                onClick={() => onImagesChange(images.filter((_, imageIndex) => imageIndex !== index))}
                disabled={uploading}
                aria-label={`Remove property photo ${index + 1}`}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {images.length < MAX_IMAGES && (
        <label className={`cursor-pointer ${uploading ? 'bg-gray-100' : 'bg-gray-50 hover:bg-gray-100'} border-2 border-dashed border-gray-300 rounded-xl p-4 transition-all text-center flex-1`}>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageChange}
            disabled={uploading}
          />
          <div className="flex flex-col items-center gap-1">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">
              {uploading ? (
                <span className="text-gray-500">
                  <span className="inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin mr-1"></span>
                  Uploading...
                </span>
              ) : (
                <>
                  <span className="text-orange-600 font-medium">Click to upload photos</span>
                  <span className="text-gray-500"> or drag</span>
                </>
              )}
            </span>
            <p className="text-xs text-gray-400">PNG, JPG up to 5MB each (maximum {MAX_IMAGES})</p>
          </div>
        </label>
        )}
      </div>
    </div>
  );
}
