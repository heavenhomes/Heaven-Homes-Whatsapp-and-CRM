"use client";
import { useState } from 'react';

export default function PropertyTable({ properties, onEdit, onDelete }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageError, setImageError] = useState({});

  const formatPrice = (price, propertyType) => {
    const formattedPrice = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price);
    
    if (propertyType === 'rent') return `${formattedPrice}/month`;
    if (propertyType === 'commercial') return `${formattedPrice} (Commercial)`;
    return formattedPrice;
  };

  const getPropertyTypeLabel = (type) => {
    switch(type) {
      case 'buy': return 'For Sale';
      case 'rent': return 'For Rent';
      case 'commercial': return 'Commercial';
      default: return type?.toUpperCase();
    }
  };

  const getPropertyTypeColor = (type) => {
    switch(type) {
      case 'buy': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'rent': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'commercial': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getConfigDisplay = (property) => {
    if (property.propertyType === 'commercial') {
      return property.spaceSize ? `${property.spaceSize} sq.ft` : 'Commercial';
    }
    return property.configuration?.toUpperCase();
  };

  const getSubTypeLabel = (subType) => {
    switch(subType) {
      case 'shop': return 'Shop';
      case 'showroom': return 'Showroom';
      case 'warehouse': return 'Warehouse';
      case 'office': return 'Office Space';
      case 'flat': return 'Flat';
      case 'apartment': return 'Apartment';
      case 'house': return 'House/Villa';
      default: return subType?.toUpperCase();
    }
  };

  const handleImageError = (propertyId) => {
    setImageError(prev => ({ ...prev, [propertyId]: true }));
  };

  if (properties.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-700 mb-2">No Properties Yet</h3>
        <p className="text-sm text-gray-400">Click "Add New Property" to get started with your first listing</p>
      </div>
    );
  }

  return (
    <>
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedImage}
              alt="Property"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Property</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Location</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sub Type</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Config/Size</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Status</th>
                <th className="text-right px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {properties.map((property) => (
                <tr key={property._id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl overflow-hidden cursor-pointer bg-gray-100 flex-shrink-0 shadow-sm hover:shadow-md transition-shadow"
                        onClick={() => property.imageUrl && !imageError[property._id] && setSelectedImage(property.imageUrl)}
                      >
                        {property.imageUrl && !imageError[property._id] ? (
                          <img 
                            src={property.imageUrl} 
                            alt={property.title}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(property._id)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800 line-clamp-1">{property.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5 capitalize">{property.propertySubType}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-5 py-4">
                    <code className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">
                      {property.propertyId}
                    </code>
                  </td>
                  
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <div className="text-sm text-gray-600">{property.city}</div>
                    <div className="text-xs text-gray-400">{property.area}</div>
                  </td>
                  
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg border ${getPropertyTypeColor(property.propertyType)}`}>
                      {getPropertyTypeLabel(property.propertyType)}
                    </span>
                  </td>
                  
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-600 capitalize">
                      {getSubTypeLabel(property.propertySubType)}
                    </span>
                  </td>
                  
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <span className="text-sm text-gray-600">
                      {getConfigDisplay(property)}
                    </span>
                  </td>
                  
                  <td className="px-5 py-4">
                    <div className="text-sm font-semibold text-gray-800">
                      {formatPrice(property.price, property.propertyType)}
                    </div>
                    {property.propertyType === 'rent' && (
                      <div className="text-xs text-gray-400">per month</div>
                    )}
                  </td>
                  
                  <td className="px-5 py-4 hidden xl:table-cell">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      <span className="text-xs text-gray-500 capitalize">{property.status}</span>
                    </span>
                  </td>
                  
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(property)}
                        className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-all duration-200"
                        title="Edit Property"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(property._id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                        title="Delete Property"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}npm 