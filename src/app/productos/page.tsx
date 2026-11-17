'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Barcode,
  Boxes,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Edit3,
  EyeOff,
  HelpCircle,
  History,
  ListFilter,
  Minus,
  Package,
  Pencil,
  Plus,
  Scale,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { Product, SaleUnitType } from '@/types/database';
import {
  calculateProfitMargin,
  calculateUnitCostFromBox,
  formatDateShortMX,
  formatDateTimeMX,
  formatMXN,
  formatQuantityWithUnit,
  generateInternalBarcode,
  getDaysUntilExpiry,
} from '@/lib/utils/formatters';
import { productFormSchema } from '@/lib/validations/schemas';
import { CameraScannerModal } from '@/components/scanner/CameraScannerModal';
import { UsbBarcodeListener } from '@/components/scanner/UsbBarcodeListener';
import { fetchOpenFoodFactsProduct } from '@/lib/services/scanner-feedback';
import { toast } from 'sonner';

interface PresentationDraft {
  name: string;
  barcode: string;
  conversion_factor: number;
  box_cost_price: number;
  presentation_sale_price?: number;
}

type ArticleModalTab = 'general' | 'inventario' | 'mayoreo';

function ProductosContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    products,
    categories,
    presentations,
    priceHistory,
    saveProduct,
    toggleProductActive,
    toggleProductFavorite,
    currentUser,
  } = useTiendaStore();

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'encargado';

  // Filtros de la tabla principal
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<'all' | 'weighable' | 'low_stock' | 'inactive'>('all');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Modales
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ArticleModalTab>('general');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyFilterProductId, setHistoryFilterProductId] = useState<string | null>(null);

  // Estado del formulario de producto (Estilo Zindey Registro de artículos)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('GENERICA');
  const [categoryId, setCategoryId] = useState('cat-abarrotes');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>('2026-11-07');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [saleUnit, setSaleUnit] = useState<SaleUnitType>('pieza');
  const [isWeighable, setIsWeighable] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [costPrice, setCostPrice] = useState<string>('20');
  const [gainPctInput, setGainPctInput] = useState<string>('25.0');
  const [salePrice, setSalePrice] = useState<string>('25');
  const [wholesalePrice, setWholesalePrice] = useState<string>('');
  const [wholesaleMinQty, setWholesaleMinQty] = useState<string>('');
  const [stockCurrent, setStockCurrent] = useState<string>('0');
  const [stockMin, setStockMin] = useState<string>('5');
  const [location, setLocation] = useState('');
  const [isPerishable, setIsPerishable] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [presDrafts, setPresDrafts] = useState<PresentationDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLookingUpOFF, setIsLookingUpOFF] = useState(false);

  const mainCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );

  const availableSubcategories = useMemo(
    () => categories.filter((c) => c.parent_id === categoryId),
    [categories, categoryId]
  );

  // Sincronización entre Costo Compra, Ganancia (%) y Precio Venta [Menudeo]
  const handleCostChange = (val: string) => {
    setCostPrice(val);
    const cost = Number(val) || 0;
    const pct = Number(gainPctInput) || 0;
    if (cost > 0) {
      const calculatedSale = +(cost * (1 + pct / 100)).toFixed(2);
      setSalePrice(String(calculatedSale));
    }
  };

  const handleGainPctChange = (val: string) => {
    setGainPctInput(val);
    const cost = Number(costPrice) || 0;
    const pct = Number(val) || 0;
    if (cost > 0) {
      const calculatedSale = +(cost * (1 + pct / 100)).toFixed(2);
      setSalePrice(String(calculatedSale));
    }
  };

  const stepGainPct = (delta: number) => {
    const currentPct = Number(gainPctInput) || 0;
    const nextPct = Math.max(0, +(currentPct + delta).toFixed(1));
    handleGainPctChange(nextPct.toFixed(1));
  };

  const handleSalePriceChange = (val: string) => {
    setSalePrice(val);
    const cost = Number(costPrice) || 0;
    const sale = Number(val) || 0;
    if (cost > 0 && sale >= 0) {
      const pct = +(((sale - cost) / cost) * 100).toFixed(1);
      setGainPctInput(pct.toFixed(1));
    }
  };

  const openCreateModal = (initialBarcode = '') => {
    setEditingProduct(null);
    setActiveTab('general');
    setName('');
    setBrand('GENERICA');
    setCategoryId('cat-abarrotes');
    setSubcategoryId('');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setBarcode(initialBarcode);
    setSku(`PROD-${String(products.length + 1).padStart(3, '0')}`);
    setSaleUnit('pieza');
    setIsWeighable(false);
    setIsFavorite(false);
    setCostPrice('20');
    setGainPctInput('25.0');
    setSalePrice('25');
    setWholesalePrice('');
    setWholesaleMinQty('');
    setStockCurrent('10');
    setStockMin('5');
    setLocation('');
    setIsPerishable(false);
    setExpiryDate('');
    setBatchCode('');
    setPhotoUrl('');
    setChangeReason('Alta de artículo');
    setPresDrafts([]);
    setFormError(null);
    setIsProductModalOpen(true);

    if (initialBarcode.length >= 8) {
      triggerOpenFoodFactsLookup(initialBarcode);
    }
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setActiveTab('general');
    setName(prod.name);
    setBrand(prod.brand || 'GENERICA');
    setCategoryId(prod.category_id);
    setSubcategoryId(prod.subcategory_id || '');
    setEntryDate((prod.created_at || '2026-11-07').slice(0, 10));
    setBarcode(prod.barcode || '');
    setSku(prod.sku);
    setSaleUnit(prod.sale_unit);
    setIsWeighable(prod.is_weighable);
    setIsFavorite(prod.is_favorite);
    setCostPrice(String(prod.cost_price));
    const pct =
      prod.cost_price > 0
        ? (((prod.sale_price - prod.cost_price) / prod.cost_price) * 100).toFixed(1)
        : '0.0';
    setGainPctInput(pct);
    setSalePrice(String(prod.sale_price));
    setWholesalePrice(prod.wholesale_price ? String(prod.wholesale_price) : '');
    setWholesaleMinQty(prod.wholesale_min_qty ? String(prod.wholesale_min_qty) : '');
    setStockCurrent(String(prod.stock_current));
    setStockMin(String(prod.stock_min));
    setLocation(prod.location || '');
    setIsPerishable(prod.is_perishable);
    setExpiryDate(prod.expiry_date || '');
    setBatchCode(prod.batch_code || '');
    setPhotoUrl(prod.photo_url || '');
    setChangeReason('Actualización de catálogo / precios');

    const prodPres = presentations
      .filter((p) => p.product_id === prod.id)
      .map((p) => ({
        name: p.name,
        barcode: p.barcode || '',
        conversion_factor: p.conversion_factor,
        box_cost_price: p.box_cost_price,
        presentation_sale_price: p.presentation_sale_price,
      }));
    setPresDrafts(prodPres);
    setFormError(null);
    setIsProductModalOpen(true);
  };

  // Parámetros URL (?buscar=..., ?nuevoCodigo=..., ?nuevo=1)
  useEffect(() => {
    const q = searchParams.get('buscar');
    if (q) setSearchQuery(q);

    const newCode = searchParams.get('nuevoCodigo');
    if (newCode && canEdit) {
      handleBarcodeScanned(newCode);
    }

    const isNuevo = searchParams.get('nuevo');
    if (isNuevo === '1' && canEdit) {
      openCreateModal('');
      router.replace('/productos');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Atajos de teclado dentro del modal (ESC, F4, F11, F12)
  useEffect(() => {
    if (!isProductModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsProductModalOpen(false);
      } else if (e.key === 'F4') {
        e.preventDefault();
        setIsPerishable((prev) => !prev);
      } else if (e.key === 'F11') {
        e.preventDefault();
        toast.success('Borrador de artículo guardado temporalmente');
      } else if (e.key === 'F12') {
        e.preventDefault();
        const formEl = document.getElementById('zindey-article-form') as HTMLFormElement | null;
        formEl?.requestSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProductModalOpen]);

  const triggerOpenFoodFactsLookup = async (codeToLookup: string) => {
    if (!codeToLookup || codeToLookup.length < 6) return;
    setIsLookingUpOFF(true);
    const suggestion = await fetchOpenFoodFactsProduct(codeToLookup);
    setIsLookingUpOFF(false);

    if (suggestion.found) {
      if (suggestion.name) setName((prev) => prev || suggestion.name!.toUpperCase());
      if (suggestion.brand) setBrand(suggestion.brand.toUpperCase());
      if (suggestion.imageUrl) setPhotoUrl((prev) => prev || suggestion.imageUrl!);
      toast.success(`Autocompletado desde Open Food Facts: ${suggestion.name}`);
    } else {
      toast.info('Código listo. Completa la descripción y precio del artículo.');
    }
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    const clean = scannedCode.trim();
    const existing = products.find((p) => p.barcode === clean || p.sku === clean);

    if (isProductModalOpen) {
      if (existing && existing.id !== editingProduct?.id) {
        toast.info(`El código ${clean} ya pertenece a "${existing.name}". Abriendo su ficha...`);
        openEditModal(existing);
      } else {
        setBarcode(clean);
        triggerOpenFoodFactsLookup(clean);
      }
      return;
    }

    if (existing) {
      toast.success(`Artículo encontrado: ${existing.name}. Abriendo ficha...`);
      openEditModal(existing);
    } else {
      toast.info(`Código ${clean} nuevo. Abriendo registro de artículo...`);
      openCreateModal(clean);
    }
  };

  const marginPreview = useMemo(
    () => calculateProfitMargin(Number(costPrice) || 0, Number(salePrice) || 0),
    [costPrice, salePrice]
  );

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (barcode.trim()) {
      const duplicateBarcode = products.find(
        (p) => p.barcode === barcode.trim() && p.id !== editingProduct?.id
      );
      if (duplicateBarcode) {
        setFormError(
          `El código de barras "${barcode.trim()}" ya está asignado al artículo "${duplicateBarcode.name}".`
        );
        return;
      }
    }

    const finalSku = sku.trim() || `PROD-${String(products.length + 1).padStart(3, '0')}`;

    const parsed = productFormSchema.safeParse({
      name: name.trim(),
      brand: brand.trim() || 'GENERICA',
      category_id: categoryId,
      subcategory_id: subcategoryId || null,
      barcode: barcode.trim() || null,
      sku: finalSku,
      sale_unit: saleUnit,
      is_weighable: isWeighable,
      is_favorite: isFavorite,
      cost_price: costPrice,
      sale_price: salePrice,
      wholesale_price: wholesalePrice ? Number(wholesalePrice) : null,
      wholesale_min_qty: wholesaleMinQty ? Number(wholesaleMinQty) : null,
      stock_current: stockCurrent,
      stock_min: stockMin,
      location,
      is_perishable: isPerishable,
      expiry_date: isPerishable && expiryDate ? expiryDate : null,
      batch_code: isPerishable && batchCode ? batchCode : null,
      photo_url: photoUrl,
      is_active: editingProduct ? editingProduct.is_active : true,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Verifica los campos obligatorios (*)');
      return;
    }

    await saveProduct(
      {
        id: editingProduct?.id,
        ...parsed.data,
      },
      presDrafts,
      changeReason || 'Actualización en catálogo'
    );

    toast.success(
      editingProduct
        ? `Artículo "${parsed.data.name}" actualizado correctamente`
        : `Artículo "${parsed.data.name}" registrado en el catálogo`
    );
    setIsProductModalOpen(false);
  };

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (filterMode === 'inactive' && p.is_active) return false;
      if (filterMode !== 'inactive' && !p.is_active) return false;
      if (filterMode === 'weighable' && !p.is_weighable) return false;
      if (filterMode === 'low_stock' && p.stock_current > p.stock_min) return false;

      if (
        selectedCategoryId !== 'ALL' &&
        p.category_id !== selectedCategoryId &&
        p.subcategory_id !== selectedCategoryId
      ) {
        return false;
      }

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery, selectedCategoryId, filterMode]);

  const getCategoryName = (catId: string) =>
    categories.find((c) => c.id === catId)?.name || 'GENERAL';

  // Marcas sugeridas + existentes
  const brandOptions = useMemo(() => {
    const set = new Set<string>(['GENERICA', 'COCA-COLA', 'BIMBO', 'SABRITAS', 'LALA', 'FUD', 'LA COSTEÑA', 'GAMESA']);
    products.forEach((p) => {
      if (p.brand) set.add(p.brand.toUpperCase());
    });
    if (brand && !set.has(brand.toUpperCase())) {
      set.add(brand.toUpperCase());
    }
    return Array.from(set);
  }, [products, brand]);

  return (
    <div className="space-y-4">
      <UsbBarcodeListener onBarcodeDetected={handleBarcodeScanned} />

      {/* Contenedor Principal Minimalista estilo Zindey */}
      <div className="rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm">
        {/* Barra Superior de Captura y Filtros */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <Barcode className="h-6 w-6 text-[#0066cc]" />
              <div className="relative w-64 sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]" />
                <input
                  type="text"
                  data-allow-barcode-burst="true"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por código, descripción o marca..."
                  className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] pl-9 pr-3 text-xs font-medium text-[#222] placeholder-[#777] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              aria-label="Filtrar por categoría"
              className="h-9 rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-semibold text-[#333] focus:border-[#0066cc] focus:bg-white focus:outline-none"
            >
              <option value="ALL">Todas las categorías ({products.length})</option>
              {mainCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name.toUpperCase()}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 rounded-md bg-[#e6e8eb] p-1">
              {[
                { id: 'all', label: 'Activos' },
                { id: 'weighable', label: 'Granel (KG)' },
                { id: 'low_stock', label: 'Stock Bajo' },
                { id: 'inactive', label: 'Inactivos' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id as typeof filterMode)}
                  className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${
                    filterMode === tab.id
                      ? 'bg-[#0066cc] text-white shadow-sm'
                      : 'text-[#555] hover:text-[#111]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setHistoryFilterProductId(null);
                setIsHistoryModalOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-[#b0bec5] bg-white px-3 text-xs font-bold text-[#455a64] hover:bg-[#f4f6f8]"
            >
              <History className="h-4 w-4 text-[#0066cc]" />
              Historial ({priceHistory.length})
            </button>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
            >
              <Camera className="h-4 w-4" />
              Escanear
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => openCreateModal('')}
                className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
              >
                <Plus className="h-4 w-4" />
                Agregar Artículo (Alt+A)
              </button>
            )}
          </div>
        </div>

        {/* Tabla Minimalista de Artículos estilo Zindey */}
        <div className="min-h-[420px] overflow-hidden rounded-lg border border-[#d5d8dc] bg-[#e6e8eb]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#d0d4d9] bg-[#eef0f3] text-[11px] font-bold text-[#555]">
                  <th className="px-3.5 py-2.5">Código</th>
                  <th className="px-3.5 py-2.5">Descripción</th>
                  <th className="px-3 py-2.5">Marca / Categoría</th>
                  <th className="px-3 py-2.5 text-center">Unidad</th>
                  <th className="px-3 py-2.5 text-right">Costo Compra</th>
                  <th className="px-3 py-2.5 text-right">Ganancia %</th>
                  <th className="px-3 py-2.5 text-right">Precio Venta</th>
                  <th className="px-3 py-2.5 text-center">Existencia</th>
                  <th className="px-3.5 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((prod, idx) => {
                  const isSelected = selectedRowId === prod.id;
                  const isLowStock = prod.stock_current <= prod.stock_min;
                  const daysExpiry = getDaysUntilExpiry(prod.expiry_date);
                  const gainPct =
                    prod.cost_price > 0
                      ? (((prod.sale_price - prod.cost_price) / prod.cost_price) * 100).toFixed(1)
                      : '0.0';

                  return (
                    <tr
                      key={prod.id}
                      onClick={() => setSelectedRowId(prod.id)}
                      onDoubleClick={() => canEdit && openEditModal(prod)}
                      className={`cursor-pointer border-b border-[#dcdcdc] transition-colors ${
                        isSelected
                          ? 'bg-[#0066cc] text-white'
                          : idx % 2 === 0
                          ? 'bg-white text-[#222] hover:bg-[#e8f0f8]'
                          : 'bg-[#f4f6f8] text-[#222] hover:bg-[#e8f0f8]'
                      }`}
                    >
                      <td className="px-3.5 py-2.5 font-mono text-[11px]">
                        {prod.barcode || prod.sku}
                      </td>

                      <td className="px-3.5 py-2.5 font-bold uppercase">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProductFavorite(prod.id);
                            }}
                            className={
                              isSelected
                                ? 'text-amber-300'
                                : prod.is_favorite
                                ? 'text-amber-500'
                                : 'text-[#ccc] hover:text-amber-400'
                            }
                            title="Favorito en POS"
                          >
                            <Star className="h-3.5 w-3.5 fill-current" />
                          </button>
                          <span>{prod.name}</span>
                          {prod.is_weighable && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-blue-50 text-[#0066cc]'
                              }`}
                            >
                              GRANEL
                            </span>
                          )}
                          {prod.is_perishable && prod.expiry_date && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : daysExpiry !== null && daysExpiry <= 5
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              Cad: {formatDateShortMX(prod.expiry_date)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 uppercase">
                        <span className="font-semibold">{prod.brand || 'GENERICA'}</span>
                        <span
                          className={`ml-1.5 text-[10px] ${
                            isSelected ? 'text-blue-100' : 'text-[#666]'
                          }`}
                        >
                          • {getCategoryName(prod.category_id)}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-center font-bold uppercase">
                        {prod.sale_unit === 'pieza'
                          ? 'PZ'
                          : prod.sale_unit === 'kg'
                          ? 'KG'
                          : prod.sale_unit.toUpperCase()}
                      </td>

                      <td className="px-3 py-2.5 text-right font-semibold">
                        {formatMXN(prod.cost_price)}
                      </td>

                      <td
                        className={`px-3 py-2.5 text-right font-bold ${
                          isSelected ? 'text-white' : 'text-[#2e7d32]'
                        }`}
                      >
                        {gainPct}%
                      </td>

                      <td className="px-3 py-2.5 text-right text-xs font-extrabold">
                        {formatMXN(prod.sale_price)}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : isLowStock
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isLowStock && <AlertTriangle className="h-3 w-3" />}
                          {formatQuantityWithUnit(prod.stock_current, prod.sale_unit)}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryFilterProductId(prod.id);
                              setIsHistoryModalOpen(true);
                            }}
                            className={`rounded p-1 ${
                              isSelected
                                ? 'text-white hover:bg-white/20'
                                : 'text-[#555] hover:bg-black/5'
                            }`}
                            title="Historial de precios"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(prod);
                                }}
                                className={`rounded p-1 ${
                                  isSelected
                                    ? 'text-white hover:bg-white/20'
                                    : 'text-[#555] hover:bg-black/5'
                                }`}
                                title="Editar artículo"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await toggleProductActive(prod.id);
                                  toast.success(
                                    prod.is_active
                                      ? `"${prod.name}" desactivado`
                                      : `"${prod.name}" reactivado`
                                  );
                                }}
                                className={`rounded p-1 ${
                                  isSelected
                                    ? 'text-white hover:bg-white/20'
                                    : 'text-[#555] hover:bg-black/5'
                                }`}
                                title={prod.is_active ? 'Dar de baja' : 'Reactivar'}
                              >
                                {prod.is_active ? (
                                  <Trash2 className="h-3.5 w-3.5" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-xs text-[#666]">
                      No se encontraron artículos con los criterios seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VENTANA MODAL ESTILO ZINDEY: "Registro de artículos" (Imagen 3)       */}
      {/* ===================================================================== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[#b0b8c1] bg-[#f4f6f8] shadow-2xl">
            {/* Barra de título estilo ventana nativa Zindey */}
            <div className="flex items-center justify-between border-b border-[#d0d5dd] bg-white px-3.5 py-2">
              <div className="flex items-center gap-2">
                <img
                  src="/logo-icono-tigre.png"
                  alt="El Tigre"
                  className="h-5 w-5 object-contain"
                />
                <span className="text-xs font-medium text-[#333]">
                  Mini-Súper EL TIGRE | {editingProduct ? `Editar artículo: ${editingProduct.name}` : 'Registro de artículos'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="rounded p-1 text-[#555] hover:bg-[#e6e8eb] hover:text-[#111]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Franja de Pestañas Superiores: General | Inventario | Mayoreo */}
            <div className="flex items-end gap-1.5 bg-[#e2e5e9] px-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`flex items-center gap-2 rounded-t-lg px-5 py-2 text-xs font-bold transition ${
                  activeTab === 'general'
                    ? 'bg-[#0066cc] text-white shadow-sm'
                    : 'bg-[#d4d8dd] text-[#444] hover:bg-[#dcdfe4]'
                }`}
              >
                <Package className="h-4 w-4" />
                General
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('inventario')}
                className={`flex items-center gap-2 rounded-t-lg px-5 py-2 text-xs font-bold transition ${
                  activeTab === 'inventario'
                    ? 'bg-[#0066cc] text-white shadow-sm'
                    : 'bg-[#d4d8dd] text-[#444] hover:bg-[#dcdfe4]'
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                Inventario
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('mayoreo')}
                className={`flex items-center gap-2 rounded-t-lg px-5 py-2 text-xs font-bold transition ${
                  activeTab === 'mayoreo'
                    ? 'bg-[#0066cc] text-white shadow-sm'
                    : 'bg-[#d4d8dd] text-[#444] hover:bg-[#dcdfe4]'
                }`}
              >
                <Coins className="h-4 w-4" />
                Mayoreo
              </button>
            </div>

            {/* Cuerpo del Formulario */}
            <form
              id="zindey-article-form"
              onSubmit={handleSaveProduct}
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              <p className="mb-3 text-xs font-bold text-[#d95c38]">
                Campos obligatorios *
              </p>

              {formError && (
                <div className="mb-3 rounded-md border border-red-400 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  {formError}
                </div>
              )}

              {/* =============================================================== */}
              {/* PESTAÑA 1: GENERAL (Idéntica a Imagen 3)                        */}
              {/* =============================================================== */}
              {activeTab === 'general' && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  {/* Tarjeta Izquierda: Información General */}
                  <div className="rounded-xl bg-white p-6 shadow-sm lg:col-span-8">
                    <div className="mb-5 flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#0066cc]">
                        Información General
                      </h3>
                      <span
                        title="Datos principales de identificación del artículo"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#8c9ba5] text-[10px] font-bold text-white"
                      >
                        ?
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                      {/* Descripción * */}
                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-[#d95c38]">
                          Descripción *
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value.toUpperCase())}
                          placeholder="REFRESCO 3L SABOR UVA"
                          className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold uppercase text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Marca + Ver más (F3) */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#333]">
                          Marca
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            className="h-9 flex-1 rounded-md border border-[#ccc] bg-[#e6e8eb] px-2.5 text-xs font-bold uppercase text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                          >
                            {brandOptions.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const nuevaMarca = window.prompt('Ingresa el nombre de la marca:', brand);
                              if (nuevaMarca && nuevaMarca.trim()) {
                                setBrand(nuevaMarca.trim().toUpperCase());
                              }
                            }}
                            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
                          >
                            <ListFilter className="h-3.5 w-3.5" />
                            Ver más (F3)
                          </button>
                        </div>
                      </div>

                      {/* Categoría * + Ver más (F2) */}
                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-[#d95c38]">
                          Categoría *
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={categoryId}
                            onChange={(e) => {
                              setCategoryId(e.target.value);
                              setSubcategoryId('');
                            }}
                            className="h-9 flex-1 rounded-md border border-[#ccc] bg-[#e6e8eb] px-2.5 text-xs font-bold uppercase text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                          >
                            {mainCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name.toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setActiveTab('inventario')}
                            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
                          >
                            <ListFilter className="h-3.5 w-3.5" />
                            Ver más (F2)
                          </button>
                        </div>
                      </div>

                      {/* Fecha de Entrada */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#333]">
                          Fecha de Entrada
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={entryDate}
                            onChange={(e) => setEntryDate(e.target.value)}
                            className="h-9 flex-1 rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                          />
                          <Calendar className="h-5 w-5 shrink-0 text-[#0066cc]" />
                        </div>
                      </div>

                      {/* Cód. de Barras */}
                      <div>
                        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#333]">
                          <span>Cód. de Barras</span>
                          <Barcode className="h-4 w-4 text-[#0066cc]" />
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={barcode}
                            onChange={(e) => setBarcode(e.target.value)}
                            placeholder="1234567890"
                            className="h-9 flex-1 rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 font-mono text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setIsScannerOpen(true)}
                            title="Escanear con cámara"
                            className="flex h-9 items-center justify-center rounded-md border border-[#0066cc] bg-white px-2.5 text-[#0066cc] hover:bg-[#e8f0f8]"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={!barcode || isLookingUpOFF}
                            onClick={() => triggerOpenFoodFactsLookup(barcode)}
                            title="Autocompletar desde Open Food Facts"
                            className="flex h-9 items-center justify-center rounded-md border border-[#0066cc] bg-white px-2.5 text-[#0066cc] hover:bg-[#e8f0f8] disabled:opacity-40"
                          >
                            <Sparkles className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Artículo Perecedero (F4) */}
                      <div className="flex items-center pt-5">
                        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-[#004a99]">
                          <input
                            type="checkbox"
                            checked={isPerishable}
                            onChange={(e) => setIsPerishable(e.target.checked)}
                            className="h-4 w-4 rounded accent-[#0066cc]"
                          />
                          Artículo Perecedero (F4)
                        </label>
                      </div>

                      {/* Cód. Interno */}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="text-sm font-medium text-[#333]">
                            Cód. Interno
                          </label>
                          <button
                            type="button"
                            onClick={() => setBarcode(generateInternalBarcode())}
                            className="text-[11px] font-bold text-[#0066cc] hover:underline"
                          >
                            Generar EAN interno
                          </button>
                        </div>
                        <input
                          type="text"
                          value={sku}
                          onChange={(e) => setSku(e.target.value.toUpperCase())}
                          placeholder="PROD-001"
                          className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 font-mono text-xs font-bold uppercase text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Fecha de Caducidad */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#333]">
                          Fecha de Caducidad
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            disabled={!isPerishable}
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                            className="h-9 flex-1 rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none disabled:opacity-50"
                          />
                          <Calendar className="h-5 w-5 shrink-0 text-[#0066cc]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta Derecha: Datos de Venta */}
                  <div className="rounded-xl bg-white p-6 shadow-sm lg:col-span-4">
                    <div className="mb-5 flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#0066cc]">
                        Datos de Venta
                      </h3>
                      <span
                        title="Cálculo de costo, margen de ganancia y precio al público"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#8c9ba5] text-[10px] font-bold text-white"
                      >
                        ?
                      </span>
                    </div>

                    <div className="space-y-5">
                      {/* Unidad de Venta + Ver más (F5) */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#333]">
                          Unidad de Venta
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={saleUnit}
                            onChange={(e) => {
                              const val = e.target.value as SaleUnitType;
                              setSaleUnit(val);
                              if (val === 'kg' || val === 'gramo') setIsWeighable(true);
                            }}
                            className="h-9 flex-1 rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold uppercase text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                          >
                            <option value="pieza">PZ</option>
                            <option value="kg">KG</option>
                            <option value="gramo">GR</option>
                            <option value="litro">LT</option>
                            <option value="paquete">PAQ / CAJA</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setActiveTab('inventario')}
                            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-3 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
                          >
                            <ListFilter className="h-3.5 w-3.5" />
                            Ver más (F5)
                          </button>
                        </div>
                      </div>

                      {/* Costo Compra */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#333]">
                          Costo Compra
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold text-[#0066cc]">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={costPrice}
                            onChange={(e) => handleCostChange(e.target.value)}
                            className="h-9 flex-1 rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Ganancia (%) con botones - (naranja) y + (verde) */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#333]">
                          Ganancia
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-[#0066cc]">%</span>
                          <input
                            type="number"
                            step="0.1"
                            value={gainPctInput}
                            onChange={(e) => handleGainPctChange(e.target.value)}
                            className="h-9 flex-1 rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => stepGainPct(-5)}
                            title="Disminuir margen 5%"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e6643c] text-white shadow-sm hover:bg-[#d4532b]"
                          >
                            <Minus className="h-3.5 w-3.5 stroke-[3]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => stepGainPct(5)}
                            title="Aumentar margen 5%"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5cb85c] text-white shadow-sm hover:bg-[#4cae4c]"
                          >
                            <Plus className="h-3.5 w-3.5 stroke-[3]" />
                          </button>
                        </div>
                      </div>

                      {/* Precio Venta [Menudeo] * */}
                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-[#d95c38]">
                          Precio Venta [Menudeo] *
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold text-[#d95c38]">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={salePrice}
                            onChange={(e) => handleSalePriceChange(e.target.value)}
                            className="h-9 flex-1 rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] font-semibold text-[#555]">
                          Utilidad neta por unidad:{' '}
                          <span className="font-bold text-[#2e7d32]">
                            {formatMXN(marginPreview.profitAmount)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* PESTAÑA 2: INVENTARIO                                           */}
              {/* =============================================================== */}
              {activeTab === 'inventario' && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  <div className="rounded-xl bg-white p-6 shadow-sm lg:col-span-6">
                    <h3 className="mb-4 text-base font-bold text-[#0066cc]">
                      Control de Existencias y Ubicación
                    </h3>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-[#d95c38]">
                          Existencia Actual ({saleUnit}) *
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={stockCurrent}
                          onChange={(e) => setStockCurrent(e.target.value)}
                          className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-[#d95c38]">
                          Stock Mínimo (Alerta) *
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={stockMin}
                          onChange={(e) => setStockMin(e.target.value)}
                          className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#333]">
                          Ubicación / Pasillo
                        </label>
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="PASILLO 1 / MOSTRADOR"
                          className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold uppercase text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#333]">
                          Subcategoría
                        </label>
                        <select
                          value={subcategoryId}
                          onChange={(e) => setSubcategoryId(e.target.value)}
                          className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] px-2.5 text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                        >
                          <option value="">— GENERAL —</option>
                          {availableSubcategories.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2.5 border-t border-[#eee] pt-4">
                      <label className="flex cursor-pointer items-center gap-2.5 text-xs font-bold text-[#333]">
                        <input
                          type="checkbox"
                          checked={isWeighable}
                          onChange={(e) => setIsWeighable(e.target.checked)}
                          className="h-4 w-4 rounded accent-[#0066cc]"
                        />
                        Artículo de venta a granel / báscula (capturar peso en KG o monto en $)
                      </label>

                      <label className="flex cursor-pointer items-center gap-2.5 text-xs font-bold text-[#333]">
                        <input
                          type="checkbox"
                          checked={isFavorite}
                          onChange={(e) => setIsFavorite(e.target.checked)}
                          className="h-4 w-4 rounded accent-[#0066cc]"
                        />
                        Destacar en acceso rápido del Punto de Venta
                      </label>
                    </div>
                  </div>

                  {/* Equivalencias y Cajas */}
                  <div className="rounded-xl bg-white p-6 shadow-sm lg:col-span-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#0066cc]">
                          Presentaciones por Caja / Paquete
                        </h3>
                        <p className="text-[11px] text-[#666]">
                          Calcula el costo unitario a partir del precio por caja cerrada.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPresDrafts((prev) => [
                            ...prev,
                            {
                              name: 'CAJA C/24 PZAS',
                              barcode: '',
                              conversion_factor: 24,
                              box_cost_price: Number(costPrice) * 24 || 240,
                            },
                          ])
                        }
                        className="flex h-8 items-center gap-1 rounded-md border border-[#0066cc] bg-white px-2.5 text-xs font-bold text-[#0066cc] hover:bg-[#e8f0f8]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Agregar Caja
                      </button>
                    </div>

                    {presDrafts.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#ccc] bg-[#f9fafb] p-6 text-center text-xs text-[#666]">
                        Sin presentaciones adicionales registradas.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {presDrafts.map((pres, idx) => {
                          const unitCostCalc = calculateUnitCostFromBox(
                            pres.box_cost_price,
                            pres.conversion_factor
                          );
                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-12 items-end gap-2 rounded-lg border border-[#e0e4e8] bg-[#f4f6f8] p-2.5"
                            >
                              <div className="col-span-5">
                                <label className="text-[10px] font-bold text-[#555]">
                                  Presentación
                                </label>
                                <input
                                  type="text"
                                  value={pres.name}
                                  onChange={(e) => {
                                    const copy = [...presDrafts];
                                    copy[idx].name = e.target.value.toUpperCase();
                                    setPresDrafts(copy);
                                  }}
                                  className="h-8 w-full rounded border border-[#ccc] bg-white px-2 text-xs font-bold"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="text-[10px] font-bold text-[#555]">
                                  Pzas/Caja
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={pres.conversion_factor}
                                  onChange={(e) => {
                                    const copy = [...presDrafts];
                                    copy[idx].conversion_factor = Number(e.target.value) || 1;
                                    setPresDrafts(copy);
                                  }}
                                  className="h-8 w-full rounded border border-[#ccc] bg-white px-2 text-xs font-bold"
                                />
                              </div>
                              <div className="col-span-3">
                                <label className="text-[10px] font-bold text-[#555]">
                                  Costo Caja ($)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={pres.box_cost_price}
                                  onChange={(e) => {
                                    const boxVal = Number(e.target.value) || 0;
                                    const copy = [...presDrafts];
                                    copy[idx].box_cost_price = boxVal;
                                    setPresDrafts(copy);
                                    handleCostChange(
                                      String(
                                        calculateUnitCostFromBox(
                                          boxVal,
                                          copy[idx].conversion_factor
                                        )
                                      )
                                    );
                                  }}
                                  className="h-8 w-full rounded border border-[#ccc] bg-white px-2 text-xs font-bold"
                                />
                              </div>
                              <div className="col-span-2 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-[#2e7d32]">
                                  {formatMXN(unitCostCalc)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPresDrafts((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="rounded p-1 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* PESTAÑA 3: MAYOREO                                              */}
              {/* =============================================================== */}
              {activeTab === 'mayoreo' && (
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-2 text-base font-bold text-[#0066cc]">
                    Configuración de Precio de Mayoreo
                  </h3>
                  <p className="mb-5 text-xs text-[#666]">
                    Se aplicará automáticamente en el Punto de Venta cuando el cliente lleve la cantidad mínima configurada.
                  </p>

                  <div className="grid max-w-xl grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-[#333]">
                        Precio Venta [Mayoreo]
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-[#0066cc]">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={wholesalePrice}
                          onChange={(e) => setWholesalePrice(e.target.value)}
                          placeholder="Ej. 22.00"
                          className="h-9 flex-1 rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-[#333]">
                        A partir de X ({saleUnit.toUpperCase()})
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={wholesaleMinQty}
                        onChange={(e) => setWholesaleMinQty(e.target.value)}
                        placeholder="Ej. 6"
                        className="h-9 w-full rounded-md border border-[#ccc] bg-[#e6e8eb] px-3 text-xs font-bold text-[#222] focus:border-[#0066cc] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Barra Inferior de Botones estilo Imagen 3 */}
              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="flex h-10 items-center gap-1.5 rounded-md border border-[#b0b8c1] bg-[#eef0f3] px-5 text-xs font-bold text-[#555] shadow-sm hover:bg-[#e2e5e9]"
                >
                  <X className="h-4 w-4" />
                  Cancelar [ESC]
                </button>

                <button
                  type="button"
                  onClick={() => toast.success('Borrador guardado temporalmente')}
                  className="flex h-10 items-center gap-1.5 rounded-md border border-[#0066cc] bg-white px-5 text-xs font-bold text-[#0066cc] shadow-sm hover:bg-[#e8f0f8]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Guardar borrador [F11]
                </button>

                <button
                  type="submit"
                  className="flex h-10 items-center gap-1.5 rounded-md bg-[#0066cc] px-6 text-xs font-bold text-white shadow-md hover:bg-[#0055b3]"
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  Aceptar [F12]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE HISTORIAL DE CAMBIOS DE PRECIO                               */}
      {/* ===================================================================== */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-lg border border-[#b0b8c1] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e0e4e8] bg-[#f4f6f8] px-5 py-3">
              <div>
                <h3 className="text-sm font-bold text-[#0066cc]">
                  Historial de Cambios de Precio (Compra y Venta)
                </h3>
                <p className="text-[11px] text-[#666]">
                  Trazabilidad por fecha, usuario y valor anterior vs. nuevo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="rounded p-1 text-[#555] hover:bg-[#e6e8eb]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-4">
              {priceHistory
                .filter(
                  (h) => !historyFilterProductId || h.product_id === historyFilterProductId
                )
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="mb-2.5 rounded-lg border border-[#e0e4e8] bg-[#f9fafb] p-3 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-xs uppercase text-[#222]">
                        {entry.product_name ||
                          products.find((p) => p.id === entry.product_id)?.name ||
                          'Artículo'}
                      </span>
                      <span className="text-[11px] text-[#666]">
                        {formatDateTimeMX(entry.created_at)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 rounded bg-white p-2 border border-[#eee]">
                      <div>
                        <span className="text-[#666]">Costo Compra: </span>
                        <span className="line-through text-[#999]">
                          {formatMXN(entry.old_cost)}
                        </span>{' '}
                        → <strong className="text-[#222]">{formatMXN(entry.new_cost)}</strong>
                      </div>
                      <div>
                        <span className="text-[#666]">Precio Venta: </span>
                        <span className="line-through text-[#999]">
                          {formatMXN(entry.old_price)}
                        </span>{' '}
                        → <strong className="text-[#0066cc]">{formatMXN(entry.new_price)}</strong>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#666]">
                      <span>Usuario: {entry.changed_by_name}</span>
                      <span>Motivo: {entry.reason}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Escáner de Cámara para Alta / Búsqueda de Producto */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
        title="Escanear Código del Artículo"
        subtitle="Si existe abre su ficha; si es nuevo abre el Registro de artículos"
      />
    </div>
  );
}

export default function ProductosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-[#666]">Cargando artículos...</div>}>
      <ProductosContent />
    </Suspense>
  );
}
