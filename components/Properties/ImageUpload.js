"use client";
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function ImageUpload({ currentImage, onImageUpload, uploading, setUploading }) {
  const [previewUrl, setPreviewUrl] = useState(currentImage || '');

  useEffect(() => {
    if (currentImage) {
      setPreviewUrl(currentImage);
    }
  }, [currentImage]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }
    
    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
    
    const formData = new FormData();
    formData.append('image', file);
    
    setUploading(true);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        onImageUpload({ url: data.url, publicId: data.publicId });
        toast.success('Image uploaded successfully');
      } else {
        toast.error(data.error || 'Failed to upload image');
        setPreviewUrl(currentImage || '');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error uploading image');
      setPreviewUrl(currentImage || '');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Property Image
      </label>
      
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Image Preview */}
        {previewUrl && (
          <div className="relative group">
            <img 
              src={previewUrl} 
              alt="Property preview" 
              className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm"
            />
            <button
              type="button"
              onClick={() => {
                setPreviewUrl('');
                onImageUpload({ url: '', publicId: '' });
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        {/* Upload Button */}
        <label className={`cursor-pointer ${uploading ? 'bg-gray-100' : 'bg-gray-50 hover:bg-gray-100'} border-2 border-dashed border-gray-300 rounded-xl p-4 transition-all text-center flex-1`}>
          <input
            type="file"
            accept="image/*"
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
                  <span className="text-orange-600 font-medium">Click to upload</span>
                  <span className="text-gray-500"> or drag</span>
                </>
              )}
            </span>
            <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
          </div>
        </label>
      </div>
    </div>
  );
}