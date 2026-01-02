import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Inbox, Plus, ChevronLeft, Clock, Tag, Folder, 
  MoreVertical, Trash2, Edit2, X, Check 
} from 'lucide-react';
import { format, setHours, setMinutes, startOfDay } from 'date-fns';
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
import { TimeWheelPicker } from '@/components/ui/time-wheel-picker';
import { DurationPresets } from '@/components/ui/duration-presets';
import { TaskTemplate, TemplateCategory, DEFAULT_TAGS, Tag as TagType } from '@/types/task';
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

  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDuration, setTemplateDuration] = useState(60);
  const [templateCategoryId, setTemplateCategoryId] = useState<string | undefined>();
  const [templateTags, setTemplateTags] = useState<TagType[]>([]);

  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#3B82F6');

  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleHour, setScheduleHour] = useState(() => {
    const hour = new Date().getHours();
    return hour > 23 ? 8 : hour;
  });
  const [scheduleMinute, setScheduleMinute] = useState(() => {
    const minute = new Date().getMinutes();
    return Math.floor(minute / 5) * 5;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);

  const sortedTemplates = getTemplatesSorted();
  
  const recentTemplates = sortedTemplates.filter(t => 
    t.lastUsedAt && (Date.now() - t.lastUsedAt.getTime()) < 24 * 60 * 60 * 1000
  );
  
  const frequentTemplates = sortedTemplates.filter(t => t.usageCount > 0);
  
  const getCategoryTemplates = (categoryId: string) => 
    sortedTemplates.filter(t => t.categoryId === categoryId);
  
  const uncategorizedTemplates = sortedTemplates.filter(t => !t.categoryId);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} שעות ${mins} דק'` : `${hours} שעות`;
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
      toast({ title: 'שגיאה', description: 'נא להזין שם לתבנית', variant: 'destructive' });
      return;
    }

    if (editingTemplate) {
      updateTemplate(editingTemplate.id, {
        title: templateTitle.trim(),
        duration: templateDuration,
        categoryId: templateCategoryId,
        tags: templateTags,
      });
      toast({ title: 'נשמר', description: 'התבנית עודכנה בהצלחה' });
    } else {
      addTemplate({
        title: templateTitle.trim(),
        duration: templateDuration,
        categoryId: templateCategoryId,
        tags: templateTags,
      });
      toast({ title: 'נוסף', description: 'תבנית חדשה נוספה בהצלחה' });
    }
    setShowTemplateDialog(false);
  };

  const handleDeleteTemplate = (template: TaskTemplate) => {
    deleteTemplate(template.id);
    toast({ title: 'נמחק', description: 'התבנית נמחקה' });
  };

  const handleScheduleTemplate = () => {
    if (!schedulingTemplate) return;

    const scheduleDateTime = setMinutes(
      setHours(startOfDay(new Date(scheduleDate)), scheduleHour), 
      scheduleMinute
    );

    scheduleTemplate(schedulingTemplate.id, scheduleDateTime);
    toast({ 
      title: 'שובץ ליומן', 
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

  const toggleTag = (tag: TagType) => {
    setTemplateTags(prev => 
      prev.some(t => t.id === tag.id)
        ? prev.filter(t => t.id !== tag.id)
        : [...prev, tag]
    );
  };

  const TemplateCard = ({ template }: { template: TaskTemplate }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative"
    >
      <Card className="p-3 flex items-center gap-3">
        <button
          onClick={() => openScheduleDialog(template)}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
          data-testid={`button-schedule-${template.id}`}
        >
          <ChevronLeft className="w-6 h-6 text-primary" />
        </button>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{template.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {formatDuration(template.duration)}
            </Badge>
            {template.usageCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {template.usageCount} שימושים
              </span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" data-testid={`button-menu-${template.id}`}>
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
      </Card>
    </motion.div>
  );

  return (
    <AppLayout>
      <div className="min-h-screen">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-2xl font-bold">תבניות משימות</h1>
              <p className="text-sm text-muted-foreground mt-1">
                משימות מוכנות לשיבוץ מהיר
              </p>
            </div>
            <Button onClick={() => openTemplateDialog()} data-testid="button-add-template">
              <Plus className="w-4 h-4 mr-2" />
              חדש
            </Button>
          </div>
        </header>

        <div className="p-4 pb-24 space-y-6">
          {templates.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Inbox className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium mb-1">אין תבניות עדיין</h2>
              <p className="text-muted-foreground text-center mb-6">
                צור תבניות משימות לשיבוץ מהיר ליומן
              </p>
              <Button onClick={() => openTemplateDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                צור תבנית ראשונה
              </Button>
            </motion.div>
          ) : (
            <>
              {recentTemplates.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    שימוש אחרון
                  </h2>
                  <div className="space-y-2">
                    {recentTemplates.slice(0, 5).map(template => (
                      <TemplateCard key={template.id} template={template} />
                    ))}
                  </div>
                </section>
              )}

              {frequentTemplates.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-primary" />
                    הכי בשימוש
                  </h2>
                  <div className="space-y-2">
                    {frequentTemplates.slice(0, 5).map(template => (
                      <TemplateCard key={template.id} template={template} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Folder className="w-5 h-5 text-primary" />
                    קטגוריות
                  </h2>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => openCategoryDialog()}
                    data-testid="button-add-category"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    קטגוריה
                  </Button>
                </div>

                {templateCategories.length === 0 && uncategorizedTemplates.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    אין קטגוריות עדיין
                  </p>
                ) : (
                  <div className="space-y-4">
                    {templateCategories.map(category => (
                      <div key={category.id}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: category.color }} 
                            />
                            <span className="font-medium">{category.name}</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6">
                                <MoreVertical className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openCategoryDialog(category)}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                עריכה
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
                        </div>
                        <div className="space-y-2 mr-5">
                          {getCategoryTemplates(category.id).map(template => (
                            <TemplateCard key={template.id} template={template} />
                          ))}
                          {getCategoryTemplates(category.id).length === 0 && (
                            <p className="text-muted-foreground text-xs py-2">ריק</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {uncategorizedTemplates.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                          <span className="font-medium text-muted-foreground">ללא קטגוריה</span>
                        </div>
                        <div className="space-y-2 mr-5">
                          {uncategorizedTemplates.map(template => (
                            <TemplateCard key={template.id} template={template} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'עריכת תבנית' : 'תבנית חדשה'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">שם התבנית *</label>
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
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => setTemplateCategoryId(undefined)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm transition-all',
                    !templateCategoryId 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-secondary hover:bg-secondary/80'
                  )}
                >
                  ללא
                </button>
                {templateCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setTemplateCategoryId(cat.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm transition-all',
                      templateCategoryId === cat.id 
                        ? 'ring-2 ring-offset-2' 
                        : 'opacity-70 hover:opacity-100'
                    )}
                    style={{ 
                      backgroundColor: `${cat.color}30`,
                      color: cat.color,
                      borderColor: cat.color,
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
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
              {editingTemplate ? 'שמור' : 'צור תבנית'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>שיבוץ ליומן</DialogTitle>
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
              שבץ ליומן
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
              <div className="flex gap-2 mt-2">
                {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(color => (
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
