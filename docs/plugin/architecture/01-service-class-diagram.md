# Service Class Diagram

```mermaid
classDiagram
    direction TB

    class IEntityQueryService {
        <<interface>>
        +dv() DataviewApi|null
        +getEntitiesByTag(tag, folder?) DataviewPage[]
        +getEntitiesByStatus(tag, status) DataviewPage[]
        +getActiveEntitiesByTag(tag) DataviewPage[]
        +getLinkedEntities(folder, tag, property, targetFile) DataviewPage[]
        +getMentions(targetFile) DataviewPage[]
        +getProjectNotes(projectFile) DataviewPage[]
        +getPage(path) DataviewPage|null
        +getActiveRecurringMeetings() DataviewPage[]
        +getRecurringMeetingEvents(meetingName) DataviewPage[]
    }

    class QueryService {
        -getApi() DataviewApi|null
        -folders FolderSettings
        +dv() DataviewApi|null
        +getEntitiesByTag(tag, folder?) DataviewPage[]
        +getEntitiesByStatus(tag, status) DataviewPage[]
        +getActiveEntitiesByTag(tag) DataviewPage[]
        +getLinkedEntities(folder, tag, property, targetFile) DataviewPage[]
        +getMentions(targetFile) DataviewPage[]
        +getProjectNotes(projectFile) DataviewPage[]
        +getPage(path) DataviewPage|null
        +getActiveRecurringMeetings() DataviewPage[]
        +getRecurringMeetingEvents(meetingName) DataviewPage[]
    }

    class IEntityQuery~TItem~ {
        <<interface>>
        +resolve() TItem[]
    }

    class TaskQuery {
        -getDv() DataviewApi|null
        -getUtilityFolder() string
        +resolve() DataviewTask[]
    }

    class RaidQuery {
        -getDv() DataviewApi|null
        +resolve() DataviewPage[]
    }

    class RefQuery {
        -getDv() DataviewApi|null
        +resolve() DataviewPage[]
        +getReferenceTopicTree() TopicNode[]
        +getTopicDescendants(name) string[]
    }

    class IEntityCreationService {
        <<interface>>
        +createClient(name) Promise~TFile~
        +createEngagement(name, clientName?) Promise~TFile~
        +createProject(name, engagementName?) Promise~TFile~
        +createPerson(name, clientName?) Promise~TFile~
        +createInboxNote(name, engagementName?) Promise~TFile~
        +createRecurringMeetingEvent(meetingName, options?) Promise~TFile~
        +createRaidItem(name, raidType, engagement?, owner?) Promise~TFile~
    }

    class EntityCreationService {
        -app App
        -settings ProjectManagerSettings
        -templates ITemplateService
        -navigation INavigationService
        +createClient(name) Promise~TFile~
        +createEngagement(name, clientName?) Promise~TFile~
        +createProject(name, engagementName?) Promise~TFile~
        +createRaidItem(name, raidType, engagement?, owner?) Promise~TFile~
        +createReferenceTopic(name) Promise~TFile~
        +createReference(name, topics, client?, engagement?) Promise~TFile~
        +createEntity(type, name, folder, extraVars?) Promise~TFile~
    }

    class IEntityConversionService {
        <<interface>>
        +convertInboxToProject(inboxFile, projectName?) Promise~TFile~
        +convertSingleToRecurring(singleFile, recurringName?) Promise~TFile~
    }

    class EntityConversionService {
        -app App
        -settings ProjectManagerSettings
        -creation IEntityCreationService
        +convertInboxToProject(inboxFile, projectName?) Promise~TFile~
        +convertSingleToRecurring(singleFile, recurringName?) Promise~TFile~
    }

    class IEntityService {
        <<interface>>
    }

    class EntityService {
        -creation IEntityCreationService
        -conversion IEntityConversionService
        +createProject(name, engagementName?) Promise~TFile~
        +createRaidItem(name, raidType, engagement?, owner?) Promise~TFile~
        +convertInboxToProject(inboxFile, projectName?) Promise~TFile~
        +convertSingleToRecurring(singleFile, recurringName?) Promise~TFile~
    }

    class IEntityHierarchyService {
        <<interface>>
        +resolveClientName(page) string|null
        +resolveEngagementName(page) string|null
    }

    class EntityHierarchyService {
        -getDv() DataviewApi|null
        -folders FolderSettings
        +resolveClientName(page) string|null
        +resolveEngagementName(page) string|null
        +getEngagementForEntity(file) DataviewPage|null
        +getClientForEntity(file) DataviewPage|null
        +getParentProject(file) DataviewPage|null
        +getEngagementNameForPath(path) string|null
        +getClientFromEngagementLink(engagementLink) string|null
    }

    class ITemplateService {
        <<interface>>
        +getTemplate(type) string
        +processTemplate(template, vars) string
        +defaultVars() Record~string,string~
    }

    class TemplateService {
        -TEMPLATES Record~EntityType,string~
        +getTemplate(type) string
        +processTemplate(template, vars) string
        +defaultVars() Record~string,string~
    }

    class INavigationService {
        <<interface>>
        +openFile(file) Promise~void~
    }

    class NavigationService {
        -app App
        +openFile(file) Promise~void~
    }

    class ITaskParser {
        <<interface>>
        +parseTaskLine(line, filePath, lineNumber) ParsedTask|null
        +parseTasksFromContent(content, filePath) ParsedTask[]
        +toggleTaskLine(originalLine, nowCompleted) string
    }

    class TaskParser {
        +parseTaskLine(line, filePath, lineNumber) ParsedTask|null
        +parseTasksFromContent(content, filePath) ParsedTask[]
        +toggleTaskLine(originalLine, nowCompleted) string
    }

    class ITaskFilterService {
        <<interface>>
        +applyDashboardFilters(tasks, f, dv, hierarchyService) DataviewTask[]
        +matchesDueDateFilter(task, filter) boolean
        +matchesTagFilter(task, tagFilter, includeUntagged) boolean
        +matchesClientFilter(task, clientFilter, includeUnassigned, dv, hierarchyService) boolean
        +matchesEngagementFilter(task, engagementFilter, includeUnassigned, dv, hierarchyService) boolean
    }

    class TaskFilterService {
        -folders FolderSettings
        +applyDashboardFilters(tasks, f, dv, hierarchyService) DataviewTask[]
        +applyContextSpecificFilters(tasks, f, dv) DataviewTask[]
        +matchesDueDateFilter(task, filter) boolean
        +matchesClientFilter(task, clientFilter, includeUnassigned, dv, hierarchyService) boolean
        +matchesInboxStatusFilter(pageStatus, filter) boolean
    }

    class ITaskSortService {
        <<interface>>
        +sortTasks(tasks, keys, contextMap?, mtimeMap?) DataviewTask[]
        +compareGroups(aTasks, bTasks, keys, contextMap?, mtimeMap?) number
    }

    class TaskSortService {
        +sortTasks(tasks, keys, contextMap?, mtimeMap?) DataviewTask[]
        +compareGroups(aTasks, bTasks, keys, contextMap?, mtimeMap?) number
    }

    class ILoggerService {
        <<interface>>
        +debug(message, context?) void
        +info(message, context?) void
        +warn(message, context?) void
        +error(message, context?, err?) void
        +flush() Promise~void~
        +cleanOldLogs() Promise~void~
    }

    class LoggerService {
        -buffer LogEntry[]
        -flushInterval ReturnType
        +debug(message, context?) void
        +info(message, context?) void
        +error(message, context?, err?) void
        +flush() Promise~void~
        +cleanOldLogs() Promise~void~
        +destroy() void
    }

    class IActionContextManager {
        <<interface>>
        +get() object|null
        +set(context) void
        +consume() object|null
    }

    class ActionContextManager {
        -context object|null
        +get() object|null
        +set(context) void
        +consume() object|null
    }

    class ICommandExecutor {
        <<interface>>
        +executeCommandById(commandId) void
    }

    class CommandExecutor {
        -app App
        +executeCommandById(commandId) void
    }

    class IScaffoldService {
        <<interface>>
        +scaffoldVault() Promise~void~
    }

    class VaultScaffoldService {
        -app App
        -settings ProjectManagerSettings
        +scaffoldVault() Promise~void~
    }

    class ITestDataService {
        <<interface>>
        +generateTestData() Promise~TestDataResult~
        +cleanTestData() Promise~number~
    }

    class TestDataService {
        -app App
        -settings ProjectManagerSettings
        -templateService ITemplateService
        -loggerService ILoggerService
        +generateTestData() Promise~TestDataResult~
        +cleanTestData() Promise~number~
    }

    IEntityService --|> IEntityCreationService
    IEntityService --|> IEntityConversionService

    class ViewStateStore {
        <<interface>>
        +load(key) ViewState|null
        +save(key, state) Promise~void~
        +isOwnWrite(file, value) boolean
    }

    class FrontmatterIO {
        <<interface>>
        +read(file) Record|null
        +write(file, mutate) Promise~void~
    }

    class FrontmatterViewStore {
        -io FrontmatterIO
        -getFile() TFile|null
        -pending PendingEcho|null
        +load(key) ViewState|null
        +save(key, state) Promise~void~
        +isOwnWrite(file, value) boolean
    }

    class SettingsViewStore {
        -getBag() Record
        -persist() Promise~void~
        +load(key) ViewState|null
        +save(key, state) Promise~void~
        +isOwnWrite() boolean
    }

    class ObsidianFrontmatterIO {
        -app App
        +read(file) Record|null
        +write(file, mutate) Promise~void~
    }

    QueryService ..|> IEntityQueryService
    TaskQuery ..|> IEntityQuery
    TaskQuery ..> QueryService : dv()
    RaidQuery ..|> IEntityQuery
    RaidQuery ..> QueryService : dv()
    RefQuery ..|> IEntityQuery
    RefQuery ..> QueryService : dv()
    EntityCreationService ..|> IEntityCreationService
    EntityConversionService ..|> IEntityConversionService
    EntityService ..|> IEntityService
    EntityHierarchyService ..|> IEntityHierarchyService
    TemplateService ..|> ITemplateService
    NavigationService ..|> INavigationService
    TaskParser ..|> ITaskParser
    TaskFilterService ..|> ITaskFilterService
    TaskSortService ..|> ITaskSortService
    LoggerService ..|> ILoggerService
    ActionContextManager ..|> IActionContextManager
    CommandExecutor ..|> ICommandExecutor
    VaultScaffoldService ..|> IScaffoldService
    TestDataService ..|> ITestDataService
    FrontmatterViewStore ..|> ViewStateStore
    SettingsViewStore ..|> ViewStateStore
    ObsidianFrontmatterIO ..|> FrontmatterIO
    FrontmatterViewStore --> FrontmatterIO : read / write

    class IViewRenderer~TItem~ {
        <<interface>>
        +mode string
        +ownsFacet? string
        +render(ctx) void
    }
    class ViewRenderContext~TItem~ {
        +container HTMLElement
        +items TItem[]
        +filters DashboardFilters
        +onFilterChange(patch) void
        +helpers TaskRenderHelpers
    }
    ContextViewRenderer ..|> IViewRenderer
    DateViewRenderer ..|> IViewRenderer
    PriorityViewRenderer ..|> IViewRenderer
    TagViewRenderer ..|> IViewRenderer
    RaidMatrixRenderer ..|> IViewRenderer
    RaidItemGroupRenderer ..|> IViewRenderer
    RaidDashboardRenderer ..|> IViewRenderer
    RaidDashboardRenderer --> RaidMatrixRenderer : composes
    RaidDashboardRenderer --> RaidItemGroupRenderer : composes
    TopicViewRenderer ..|> IViewRenderer
    FlatGroupedViewRenderer ..|> IViewRenderer
    IViewRenderer ..> ViewRenderContext : render(ctx)

    class Facet~Item~ {
        +key string
        +accessor?(item) unknown
        +predicate?(item, selected) boolean
        +appliesWhen?(viewMode) boolean
    }
    class FilterSpec~Item~ {
        <<interface>>
        +facets Facet[]
        +specWithout(key) FilterSpec
    }
    class FilterState {
        +selections Record~string,unknown~
        +viewMode string
    }
    class FilterEngine {
        <<pure>>
        +apply(items, spec, state) Item[]
    }
    FilterSpec *-- Facet
    FilterEngine ..> FilterSpec : catalog
    FilterEngine ..> FilterState : selections + viewMode
    TaskFilterService ..> FilterEngine : delegates
    TaskFilterService ..> FilterSpec : buildTaskFilterSpec

    class DashboardShell~TItem,THelpers~ {
        <<POJO, Obsidian-free>>
        -deps DashboardShellDeps
        +render(outputEl) Promise~void~
    }
    class DashboardViewComponent {
        <<interface>>
        +render() void
        +refreshOutput() void
        +destroy() void
    }
    class DashboardRenderChild {
        +onload() void
        +onunload() void
        +render() void
    }
    class DashboardItemViewHost {
        +onOpen() Promise~void~
        +onClose() Promise~void~
    }
    class ReferenceDashboardItemView {
        +onOpen() Promise~void~
    }
    class ReferenceDashboardView {
        +render() void
        +refreshOutput() void
        +destroy() void
    }
    DashboardShell ..> IEntityQuery : resolve()
    DashboardShell ..> FilterEngine : apply()
    DashboardShell ..> IViewRenderer : render(ctx)
    DashboardRenderChild ..> DashboardViewComponent : hosts
    DashboardItemViewHost ..> DashboardViewComponent : hosts
    DashboardRenderChild ..> ViewStateStore : persist / isOwnWrite
    DashboardItemViewHost ..> ViewStateStore : persist
    ReferenceDashboardItemView --|> DashboardItemViewHost
    ReferenceDashboardItemView ..> SettingsViewStore : persist
    ReferenceDashboardView ..|> DashboardViewComponent
    ReferenceDashboardView ..> DashboardShell : builds
    ReferenceDashboardView ..> RefQuery : query

    class EntityQueryRegistry {
        <<factory table, Partial-tolerant>>
        +register(type, factory) void
        +resolve(type, getDv) IEntityQuery|null
    }
    class ENTITY_KINDS {
        <<identity catalog, keyed by EntityType>>
        tag? / folder? / fields
    }
    EntityQueryRegistry ..> IEntityQuery : factory builds
    EntityQueryRegistry ..> RaidQuery : back-fill
    EntityQueryRegistry ..> RefQuery : back-fill
```
