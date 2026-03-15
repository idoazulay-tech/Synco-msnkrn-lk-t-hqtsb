import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Archive, Plus, ChevronLeft, Clock, Tag, Folder, 
  MoreVertical, Trash2, Edit2, Check, TrendingUp,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { format, setHours, setMinutes, startOfDay, addHours } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTaskStore } from '@/store/taskStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TimeWheelPicker } from '@/components/ui/time-wheel-picker';
import { DurationPresets } from '@/components/ui/duration-presets';
import { TaskTemplate, TemplateCategory, DEFAULT_CATEGORIES, DEFAULT_TAGS, Tag as TagType } from '@/types/task';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const StandbyPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    templates, 
    templateCategories, 
    getTemplatesSorted,
    addTemplate, 
    updateTemplate, 
    deleteTemplate, 
    scheduleTemplate,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useTaskStore();

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [editingCategory, setEditingCategory] = useState<TemplateCategory | null>(null);
  const [schedulingTemplate, setSchedulingTemplate] = useState<TaskTemplate | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDuration, setTemplateDuration] = useState(60);
  const [templateCategoryId, setTemplateCategoryId] = useState<string | undefined>();
  const [templateSubcategoryId, setTemplateSubcategoryId] = useState<string | undefined>();
  const [templateTags, setTemplateTags] = useState<TagType[]>([]);

  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#3B82F6');

  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleHour, setScheduleHour] = useState(() => new Date().getHours());
  const [scheduleMinute, setScheduleMinute] = useState(() => Math.floor(new Date().getMinutes() / 5) * 5);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('cabinet_seeded')) return;
    if (templateCategories.length > 0) return;

    const CABINET_SEED: { name: string; color: string; templates: { title: string; duration: number }[] }[] = [
      { name: 'עבודה', color: '#3B82F6', templates: [{ title: 'פגישת צוות', duration: 60 }, { title: 'כתיבת דוח', duration: 90 }, { title: 'שיחת לקוח', duration: 30 }] },
      { name: 'כסף', color: '#22C55E', templates: [{ title: 'תשלום חשבונות', duration: 15 }, { title: 'בדיקת חשבון בנק', duration: 10 }, { title: 'תכנון תקציב', duration: 30 }] },
      { name: 'עסק', color: '#8B5CF6', templates: [{ title: 'פגישת עסקים', duration: 60 }, { title: 'הכנת הצעת מחיר', duration: 45 }] },
      { name: 'בריאות', color: '#EF4444', templates: [{ title: 'ביקור רופא', duration: 60 }, { title: 'לקיחת תרופות', duration: 5 }, { title: 'בדיקות שגרתיות', duration: 45 }] },
      { name: 'אימון', color: '#F59E0B', templates: [{ title: 'ריצה בוקר', duration: 30 }, { title: 'חדר כושר', duration: 60 }, { title: 'יוגה', duration: 45 }] },
      { name: 'בית', color: '#10B981', templates: [{ title: 'ניקיון שבועי', duration: 120 }, { title: 'כביסה', duration: 30 }, { title: 'קניות לבית', duration: 45 }] },
      { name: 'זוגיות', color: '#EC4899', templates: [{ title: 'דייט', duration: 120 }, { title: 'שיחה עם בן/בת זוג', duration: 20 }] },
      { name: 'משפחה', color: '#A855F7', templates: [{ title: 'ביקור הורים', duration: 120 }, { title: 'ארוחת משפחה', duration: 90 }, { title: 'שיחה עם הילדים', duration: 15 }] },
      { name: 'חברים', color: '#14B8A6', templates: [{ title: 'מפגש חברים', duration: 120 }, { title: 'שיחת טלפון', duration: 15 }] },
      { name: 'סידורים', color: '#06B6D4', templates: [{ title: 'דואר', duration: 20 }, { title: 'תשלומים', duration: 15 }, { title: 'ביורוקרטיה', duration: 30 }] },
      { name: 'למידה', color: '#6366F1', templates: [{ title: 'שיעור', duration: 60 }, { title: 'קריאת ספר', duration: 30 }, { title: 'קורס אונליין', duration: 45 }] },
      { name: 'פיתוח עצמי', color: '#84CC16', templates: [{ title: 'מדיטציה', duration: 15 }, { title: 'כתיבת יומן', duration: 20 }, { title: 'רפלקציה', duration: 15 }] },
      { name: 'סינקו', color: '#F97316', templates: [{ title: 'הגדרת יעדים', duration: 20 }, { title: 'סיכום שבוע', duration: 30 }, { title: 'תכנון מחר', duration: 10 }] },
      { name: 'תכנון', color: '#0EA5E9', templates: [{ title: 'תכנון שבועי', duration: 30 }, { title: 'הגדרת עדיפויות', duration: 20 }] },
      { name: 'ניהול זמן', color: '#78716C', templates: [{ title: 'סקירת משימות', duration: 15 }, { title: 'תעדוף', duration: 15 }, { title: 'ניקוי רשימה', duration: 10 }] },
      { name: 'דיגיטל', color: '#0284C7', templates: [{ title: 'בדיקת אימיילים', duration: 20 }, { title: 'ניקוי תיבת דואר', duration: 15 }] },
      { name: 'תקשורת', color: '#7C3AED', templates: [{ title: 'מענה להודעות', duration: 15 }, { title: 'שיחות חזרה', duration: 20 }] },
      { name: 'אדמיניסטרציה', color: '#64748B', templates: [{ title: 'מסמכים', duration: 30 }, { title: 'חוזים וטפסים', duration: 45 }] },
      { name: 'אירועים', color: '#D97706', templates: [{ title: 'הכנה לאירוע', duration: 60 }, { title: 'תיאום לוגיסטיקה', duration: 30 }] },
      { name: 'חגים', color: '#DC2626', templates: [{ title: 'הכנות לחג', duration: 60 }, { title: 'קניית מתנות', duration: 45 }] },
      { name: 'ימי הולדת', color: '#BE185D', templates: [{ title: 'קניית מתנה', duration: 30 }, { title: 'הכנת הפתעה', duration: 60 }] },
      { name: 'הערות חשובות', color: '#059669', templates: [{ title: 'תיעוד מחשבות', duration: 10 }, { title: 'רשימת מטלות', duration: 15 }] },
    ];

    CABINET_SEED.forEach(catData => {
      const newCat = addCategory({ name: catData.name, color: catData.color });
      catData.templates.forEach(tmpl => {
        addTemplate({ title: tmpl.title, duration: tmpl.duration, categoryId: newCat.id, tags: [] });
      });
    });

    localStorage.setItem('cabinet_seeded', '1');
  }, []);

  const sortedTemplates = getTemplatesSorted();
  
  const frequentTemplates = useMemo(() => 
    [...templates].sort((a, b) => b.usageCount - a.usageCount).slice(0, 10),
    [templates]
  );
  
  const getCategoryTemplates = (categoryId: string) => 
    sortedTemplates
      .filter(t => t.categoryId === categoryId)
      .sort((a, b) => b.usageCount - a.usageCount);
  
  const uncategorizedTemplates = sortedTemplates.filter(t => !t.categoryId);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
  };

  const openTemplateDialog = (template?: TaskTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateTitle(template.title);
      setTemplateDuration(template.duration);
      setTemplateCategoryId(template.categoryId);
      setTemplateTags(template.tags);
    } else {
      setEditingTemplate(null);
      setTemplateTitle('');
      setTemplateDuration(60);
      setTemplateCategoryId(undefined);
      setTemplateTags([]);
    }
    setShowTemplateDialog(true);
  };

  const openScheduleDialog = (template: TaskTemplate) => {
    setSchedulingTemplate(template);
    setScheduleDate(format(new Date(), 'yyyy-MM-dd'));
    const now = new Date();
    setScheduleHour(now.getHours());
    setScheduleMinute(Math.floor(now.getMinutes() / 5) * 5);
    setShowScheduleDialog(true);
  };

  const quickSchedule = (template: TaskTemplate, offsetHours: number) => {
    const startTime = offsetHours === 0 ? new Date() : addHours(new Date(), offsetHours);
    scheduleTemplate(template.id, startTime);
    toast({ 
      title: 'הועתק ליומן', 
      description: `"${template.title}" נוסף ליומן` 
    });
    navigate('/day');
  };

  const openCategoryDialog = (category?: TemplateCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
      setCategoryColor(category.color);
    } else {
      setEditingCategory(null);
      setCategoryName('');
      setCategoryColor('#3B82F6');
    }
    setShowCategoryDialog(true);
  };

  const handleSaveTemplate = () => {
    if (!templateTitle.trim()) {
      toast({ title: 'שגיאה', description: 'נא להזין שם למשימה', variant: 'destructive' });
      return;
    }

    if (editingTemplate) {
      updateTemplate(editingTemplate.id, {
        title: templateTitle.trim(),
        duration: templateDuration,
        categoryId: templateCategoryId,
        tags: templateTags,
      });
      toast({ title: 'נשמר', description: 'המשימה עודכנה בהצלחה' });
    } else {
      addTemplate({
        title: templateTitle.trim(),
        duration: templateDuration,
        categoryId: templateCategoryId,
        tags: templateTags,
      });
      toast({ title: 'נוסף', description: 'משימה חדשה נוספה לארון' });
    }
    setShowTemplateDialog(false);
  };

  const handleDeleteTemplate = (template: TaskTemplate) => {
    deleteTemplate(template.id);
    toast({ title: 'נמחק', description: 'המשימה נמחקה מהארון' });
  };

  const handleScheduleTemplate = () => {
    if (!schedulingTemplate) return;

    const scheduleDateTime = setMinutes(
      setHours(startOfDay(new Date(scheduleDate)), scheduleHour), 
      scheduleMinute
    );

    scheduleTemplate(schedulingTemplate.id, scheduleDateTime);
    toast({ 
      title: 'הועתק ליומן', 
      description: `"${schedulingTemplate.title}" נוסף ליומן` 
    });
    setShowScheduleDialog(false);
    navigate('/day');
  };

  const handleSaveCategory = () => {
    if (!categoryName.trim()) {
      toast({ title: 'שגיאה', description: 'נא להזין שם לקטגוריה', variant: 'destructive' });
      return;
    }

    if (editingCategory) {
      updateCategory(editingCategory.id, { name: categoryName.trim(), color: categoryColor });
      toast({ title: 'נשמר', description: 'הקטגוריה עודכנה' });
    } else {
      addCategory({ name: categoryName.trim(), color: categoryColor });
      toast({ title: 'נוסף', description: 'קטגוריה חדשה נוספה' });
    }
    setShowCategoryDialog(false);
  };

  const handleDeleteCategory = (category: TemplateCategory) => {
    deleteCategory(category.id);
    toast({ title: 'נמחק', description: 'הקטגוריה נמחקה' });
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const toggleTag = (tag: TagType) => {
    setTemplateTags(prev => 
      prev.some(t => t.id === tag.id)
        ? prev.filter(t => t.id !== tag.id)
        : [...prev, tag]
    );
  };

  const TemplateCard = ({ template, compact = false }: { template: TaskTemplate; compact?: boolean }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative"
    >
      <Card className={cn("flex items-center gap-2", compact ? "p-2" : "p-3")}>
        <button
          onClick={() => openScheduleDialog(template)}
          className="flex-shrink-0 px-2 py-1 rounded-full bg-primary/10 flex items-center gap-1 hover:bg-primary/20 transition-colors"
          data-testid={`button-schedule-${template.id}`}
        >
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">שבץ</span>
        </button>
        
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium truncate", compact && "text-sm")}>{template.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(template.duration)}
            </span>
            {template.usageCount > 0 && (
              <span className="text-xs text-muted-foreground">
                x{template.usageCount}
              </span>
            )}
          </div>
        </div>

        {!compact && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-menu-${template.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openTemplateDialog(template)}>
                <Edit2 className="w-4 h-4 mr-2" />
                עריכה
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDeleteTemplate(template)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                מחיקה
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Card>
    </motion.div>
  );

  return (
    <AppLayout>
      <div className="min-h-screen">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Archive className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">ארון המשימות</h1>
            </div>
            <Button size="sm" onClick={() => openTemplateDialog()} data-testid="button-add-template">
              <Plus className="w-4 h-4 mr-1" />
              חדש
            </Button>
          </div>
        </header>

        <div className="p-4 pb-24">
          {templates.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Archive className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium mb-1">הארון ריק</h2>
              <p className="text-muted-foreground text-center mb-6 px-4">
                הוסף משימות לארון וחסוך זמן בהעתקה ליומן
              </p>
              <Button onClick={() => openTemplateDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                הוסף משימה ראשונה
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-0">
              {/* Top shelf - Frequent templates */}
              <div className="bg-muted/30 rounded-t-xl border-x border-t border-border p-3">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  שכיחות
                </h2>
                <div className="space-y-2">
                  {frequentTemplates.length > 0 ? (
                    frequentTemplates.map(template => (
                      <Popover key={template.id}>
                        <PopoverTrigger asChild>
                          <Card className="p-2.5 cursor-pointer hover:bg-muted/40 transition-colors" data-testid={`frequent-template-${template.id}`}>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{template.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(template.duration)}
                                  </span>
                                  {template.usageCount > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      x{template.usageCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </div>
                          </Card>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 text-xs px-3"
                              onClick={() => quickSchedule(template, 0)}
                              data-testid={`quick-now-${template.id}`}
                            >
                              עכשיו
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs px-3"
                              onClick={() => quickSchedule(template, 1)}
                              data-testid={`quick-1h-${template.id}`}
                            >
                              +1h
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs px-3"
                              onClick={() => quickSchedule(template, 2)}
                              data-testid={`quick-2h-${template.id}`}
                            >
                              +2h
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs px-2"
                              onClick={() => openScheduleDialog(template)}
                              data-testid={`quick-custom-${template.id}`}
                            >
                              <Clock className="w-4 h-4" />
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">אין נתונים עדיין</p>
                  )}
                </div>
              </div>

              {/* Shelf divider */}
              <div className="h-2 bg-gradient-to-b from-border to-muted/50 border-x border-border" />

              {/* Bottom shelf - Categories */}
              <section className="bg-muted/20 rounded-b-xl border-x border-b border-border p-3">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Folder className="w-5 h-5 text-primary" />
                    קטגוריות
                  </h2>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => openCategoryDialog()}
                    data-testid="button-add-category"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    קטגוריה
                  </Button>
                </div>

                <div className="space-y-2">
                  {templateCategories.map(category => {
                    const categoryTemplates = getCategoryTemplates(category.id);
                    const isExpanded = expandedCategories.has(category.id);
                    
                    return (
                      <div key={category.id} className="rounded-lg border border-border overflow-hidden">
                        <div
                          onClick={() => toggleCategory(category.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                          role="button"
                          tabIndex={0}
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: category.color }} 
                            />
                            <span className="font-medium">{category.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {categoryTemplates.length}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button size="icon" variant="ghost" className="h-6 w-6">
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openCategoryDialog(category)}>
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  עריכה
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setTemplateCategoryId(category.id);
                                  openTemplateDialog();
                                }}>
                                  <Plus className="w-4 h-4 mr-2" />
                                  הוסף משימה
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteCategory(category)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  מחיקה
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-border"
                            >
                              <div className="p-2 space-y-2 bg-muted/30">
                                {categoryTemplates.length > 0 ? (
                                  categoryTemplates.map(template => (
                                    <TemplateCard key={template.id} template={template} />
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground py-4 text-center">
                                    אין משימות בקטגוריה זו
                                  </p>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="w-full"
                                  onClick={() => {
                                    setTemplateCategoryId(category.id);
                                    openTemplateDialog();
                                  }}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  הוסף משימה
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {uncategorizedTemplates.length > 0 && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <button
                        onClick={() => toggleCategory('uncategorized')}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0" />
                          <span className="font-medium text-muted-foreground">ללא קטגוריה</span>
                          <Badge variant="secondary" className="text-xs">
                            {uncategorizedTemplates.length}
                          </Badge>
                        </div>
                        {expandedCategories.has('uncategorized') ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                      
                      <AnimatePresence>
                        {expandedCategories.has('uncategorized') && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border"
                          >
                            <div className="p-2 space-y-2 bg-muted/30">
                              {uncategorizedTemplates.map(template => (
                                <TemplateCard key={template.id} template={template} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'עריכת משימה' : 'משימה חדשה לארון'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">שם המשימה *</label>
              <Input
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                placeholder="לדוגמה: פגישת עבודה"
                className="mt-1"
                data-testid="input-template-title"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">משך זמן</label>
              <DurationPresets
                selectedDuration={templateDuration}
                onDurationSelect={setTemplateDuration}
              />
            </div>

            <div>
              <label className="text-sm font-medium">קטגוריה</label>
              <Select value={templateCategoryId || 'none'} onValueChange={(v) => setTemplateCategoryId(v === 'none' ? undefined : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="בחר קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא קטגוריה</SelectItem>
                  {templateCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">תגיות</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DEFAULT_TAGS.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'px-2 py-1 rounded-full text-xs transition-all',
                      templateTags.some(t => t.id === tag.id) 
                        ? 'ring-2 ring-offset-1' 
                        : 'opacity-60 hover:opacity-100'
                    )}
                    style={{ 
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>ביטול</Button>
            <Button onClick={handleSaveTemplate} data-testid="button-save-template">
              {editingTemplate ? 'שמור' : 'הוסף לארון'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>העתקה ליומן</DialogTitle>
          </DialogHeader>
          {schedulingTemplate && (
            <div className="space-y-4 py-4">
              <Card className="p-3">
                <p className="font-semibold">{schedulingTemplate.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDuration(schedulingTemplate.duration)}
                  </Badge>
                </div>
              </Card>

              <div>
                <label className="text-sm font-medium">תאריך</label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="mt-1"
                  data-testid="input-schedule-date"
                />
              </div>

              <div>
                <label className="text-sm font-medium">שעת התחלה</label>
                <Button
                  variant="outline"
                  className="w-full mt-1 text-xl font-bold h-12"
                  onClick={() => setShowTimePicker(true)}
                  data-testid="button-schedule-time"
                >
                  {scheduleHour.toString().padStart(2, '0')}:{scheduleMinute.toString().padStart(2, '0')}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>ביטול</Button>
            <Button onClick={handleScheduleTemplate} data-testid="button-confirm-schedule">
              <Check className="w-4 h-4 mr-2" />
              העתק ליומן
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">שם הקטגוריה</label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="לדוגמה: עבודה"
                className="mt-1"
                data-testid="input-category-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">צבע</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'].map(color => (
                  <button
                    key={color}
                    onClick={() => setCategoryColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-transform',
                      categoryColor === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>ביטול</Button>
            <Button onClick={handleSaveCategory} data-testid="button-save-category">
              {editingCategory ? 'שמור' : 'צור קטגוריה'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TimeWheelPicker
        open={showTimePicker}
        onOpenChange={setShowTimePicker}
        hour={scheduleHour}
        minute={scheduleMinute}
        onTimeChange={(h, m) => { setScheduleHour(h); setScheduleMinute(m); }}
        title="שעת התחלה"
      />
    </AppLayout>
  );
};

export default StandbyPage;
