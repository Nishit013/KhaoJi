import React, { useState } from 'react';
import { useStore } from '../App';
import { Product, VariantGroup, VariantOption } from '../types';

const Inventory: React.FC = () => {
  const { products, categories, addProduct, updateProduct } = useStore();
  const [filter, setFilter] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Dropdown State
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: '', // Dynamic String
    price: 0,
    stock: 100, // Default to In Stock
    taxRate: 5,
    isVeg: true,
    variants: []
  });

  const filtered = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category: '', // Start empty to force user to enter a new category or select existing
      price: 0,
      stock: 100, // Default In Stock
      taxRate: 5,
      isVeg: true,
      variants: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({ 
        ...product,
        variants: product.variants ? JSON.parse(JSON.stringify(product.variants)) : [] // Deep copy to avoid mutating store directly
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.price || formData.price < 0) {
      alert("Please enter valid name and price");
      return;
    }

    if (!formData.category) {
        alert("Please select or enter a category");
        return;
    }

    if (editingProduct) {
      // Update existing
      updateProduct({
        ...editingProduct,
        ...formData as Product
      });
    } else {
      // Add new
      addProduct(formData as Omit<Product, 'id'>);
    }
    
    setIsModalOpen(false);
  };

  const toggleProductStock = (product: Product) => {
      updateProduct({
          ...product,
          stock: product.stock > 0 ? 0 : 100
      });
  };

  // --- Variant Management Logic ---

  const addVariantGroup = () => {
    const newGroup: VariantGroup = {
      id: `vg_${Date.now()}`,
      name: '',
      options: []
    };
    setFormData(prev => ({ ...prev, variants: [...(prev.variants || []), newGroup] }));
  };

  const removeVariantGroup = (groupIndex: number) => {
    setFormData(prev => {
        const newVariants = [...(prev.variants || [])];
        newVariants.splice(groupIndex, 1);
        return { ...prev, variants: newVariants };
    });
  };

  const updateVariantGroup = (index: number, name: string) => {
     setFormData(prev => {
        const newVariants = [...(prev.variants || [])];
        newVariants[index] = { ...newVariants[index], name };
        return { ...prev, variants: newVariants };
    });
  };

  const addVariantOption = (groupIndex: number) => {
    setFormData(prev => {
        const newVariants = [...(prev.variants || [])];
        const group = newVariants[groupIndex];
        const newOption: VariantOption = {
            id: `vo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: '',
            priceModifier: 0
        };
        newVariants[groupIndex] = { ...group, options: [...group.options, newOption] };
        return { ...prev, variants: newVariants };
    });
  };

  const removeVariantOption = (groupIndex: number, optionIndex: number) => {
    setFormData(prev => {
        const newVariants = [...(prev.variants || [])];
        const group = newVariants[groupIndex];
        const newOptions = [...group.options];
        newOptions.splice(optionIndex, 1);
        newVariants[groupIndex] = { ...group, options: newOptions };
        return { ...prev, variants: newVariants };
    });
  };

  const updateVariantOption = (groupIndex: number, optionIndex: number, field: keyof VariantOption, value: any) => {
     setFormData(prev => {
        const newVariants = [...(prev.variants || [])];
        const group = newVariants[groupIndex];
        const newOptions = [...group.options];
        newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value };
        newVariants[groupIndex] = { ...group, options: newOptions };
        return { ...prev, variants: newVariants };
    });
  };


  return (
    <div className="p-8 h-full overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-slate-800">Inventory Management</h2>
        <button 
          onClick={handleOpenAddModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95"
        >
          + Add New Item
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <input 
                type="text" 
                placeholder="Search products..." 
                className="px-4 py-2 border rounded-lg w-64 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />
            <div className="text-sm text-slate-500">
                Total Items: <span className="font-bold text-slate-800">{products.length}</span>
            </div>
        </div>
        
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm font-semibold uppercase sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 border-b border-slate-200">Item Name</th>
                <th className="px-6 py-4 border-b border-slate-200">Category</th>
                <th className="px-6 py-4 border-b border-slate-200">Price</th>
                <th className="px-6 py-4 border-b border-slate-200">Variants</th>
                <th className="px-6 py-4 border-b border-slate-200">Availability</th>
                <th className="px-6 py-4 text-right border-b border-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(product => {
                const isInStock = product.stock > 0;
                return (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">
                      <span>{product.name}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold">{product.category}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">₹{product.price}</td>
                  <td className="px-6 py-4">
                    {product.variants && product.variants.length > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {product.variants.map(v => v.name).join(', ')}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                      {/* Toggle Switch */}
                      <button 
                        onClick={() => toggleProductStock(product)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isInStock ? 'bg-green-500' : 'bg-slate-200'}`}
                      >
                         <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isInStock ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <span className={`ml-3 text-sm font-medium ${isInStock ? 'text-green-700' : 'text-slate-400'}`}>
                        {isInStock ? 'In Stock' : 'Unavailable'}
                      </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleOpenEditModal(product)}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto">
              <form id="productForm" onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Name */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                {/* Category - Enhanced Dropdown */}
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <div className="relative">
                    <input
                        type="text"
                        required
                        placeholder="Select or type new..."
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                        value={formData.category}
                        onChange={e => {
                            setFormData({...formData, category: e.target.value});
                            setShowCategoryDropdown(true);
                        }}
                        onFocus={() => setShowCategoryDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                        autoComplete="off"
                    />
                    {/* Dropdown Arrow */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    {/* Custom Dropdown List */}
                    {showCategoryDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-fade-in">
                            {categories
                                .filter(c => c.toLowerCase().includes((formData.category || '').toLowerCase()))
                                .map(cat => (
                                <div 
                                    key={cat}
                                    className="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm text-slate-700 border-b border-slate-50 last:border-0"
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // Prevent input blur
                                        setFormData(prev => ({...prev, category: cat}));
                                        setShowCategoryDropdown(false);
                                    }}
                                >
                                    {cat}
                                </div>
                            ))}
                            
                            {/* Empty State / Create New Hint */}
                            {categories.filter(c => c.toLowerCase().includes((formData.category || '').toLowerCase())).length === 0 && (
                                <div className="px-4 py-3 text-sm text-slate-500 italic bg-slate-50">
                                    {formData.category ? (
                                        <span className="text-indigo-600 font-medium">Create new category "{formData.category}"</span>
                                    ) : (
                                        "Type to add a new category..."
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Select from list or type to create new.</p>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                  />
                </div>

                {/* Stock Toggle (Hidden numeric input) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Item Status</label>
                  <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({...prev, stock: (prev.stock || 0) > 0 ? 0 : 100}))}
                        className={`flex-1 py-2 px-4 rounded-lg border font-bold text-sm transition-all ${
                            (formData.stock || 0) > 0 
                            ? 'bg-green-50 border-green-200 text-green-700 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                          In Stock
                      </button>
                      <button
                         type="button"
                         onClick={() => setFormData(prev => ({...prev, stock: 0}))}
                         className={`flex-1 py-2 px-4 rounded-lg border font-bold text-sm transition-all ${
                            (formData.stock || 0) <= 0 
                            ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                          Unavailable
                      </button>
                  </div>
                </div>

                {/* Tax Rate */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                    value={formData.taxRate}
                    onChange={e => setFormData({...formData, taxRate: parseFloat(e.target.value)})}
                  />
                </div>

                {/* Veg/Non-Veg Toggle - Move to span 2 now that Image URL is gone */}
                <div className="col-span-1 flex items-center space-x-3 mt-6">
                  <input
                    type="checkbox"
                    id="isVeg"
                    className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-white"
                    checked={formData.isVeg}
                    onChange={e => setFormData({...formData, isVeg: e.target.checked})}
                  />
                  <label htmlFor="isVeg" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                    Is Vegetarian?
                  </label>
                </div>

                {/* Variant Configuration */}
                <div className="col-span-2 border-t border-slate-200 pt-6 mt-2">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                        <h4 className="text-lg font-bold text-slate-800">Product Variants</h4>
                        <p className="text-xs text-slate-500">Add options like Size, Spice Level, etc.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addVariantGroup}
                      className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100 border border-indigo-100"
                    >
                      + Add Variant Group
                    </button>
                  </div>
                  
                  {(!formData.variants || formData.variants.length === 0) && (
                      <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                          <p className="text-sm text-slate-400 italic">No variants configured for this product.</p>
                      </div>
                  )}

                  <div className="space-y-4">
                    {formData.variants?.map((group, gIdx) => (
                      <div key={group.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-3">
                             <input 
                                type="text" 
                                placeholder="Group Name (e.g. Size)" 
                                className="bg-white border border-slate-200 px-3 py-1.5 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-slate-700 w-1/2"
                                value={group.name}
                                onChange={(e) => updateVariantGroup(gIdx, e.target.value)}
                             />
                             <button type="button" onClick={() => removeVariantGroup(gIdx)} className="text-red-400 hover:text-red-600 text-xs font-medium">Remove Group</button>
                        </div>
                        
                        <div className="space-y-2 pl-2">
                            {group.options.map((option, oIdx) => (
                                <div key={option.id} className="flex gap-2 items-center">
                                    <input 
                                        type="text"
                                        placeholder="Option Name (e.g. Small)"
                                        className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={option.name}
                                        onChange={(e) => updateVariantOption(gIdx, oIdx, 'name', e.target.value)}
                                    />
                                    <div className="flex items-center bg-white border border-slate-200 rounded px-2 w-32 focus-within:ring-1 focus-within:ring-indigo-500">
                                        <span className="text-slate-400 text-xs mr-1">₹</span>
                                        <input 
                                            type="number"
                                            placeholder="Diff"
                                            className="w-full py-1.5 text-sm outline-none bg-transparent text-slate-800"
                                            value={option.priceModifier}
                                            onChange={(e) => updateVariantOption(gIdx, oIdx, 'priceModifier', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                     <button type="button" onClick={() => removeVariantOption(gIdx, oIdx)} className="text-slate-400 hover:text-red-500 px-1 text-lg leading-none">&times;</button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => addVariantOption(gIdx)}
                                className="text-xs text-indigo-600 font-bold mt-2 hover:underline flex items-center"
                            >
                                + Add Option
                            </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="productForm"
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-colors"
              >
                {editingProduct ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;