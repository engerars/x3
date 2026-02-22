// Module extracted from n33.html: Vue application setup and runtime
import { databaseService, appUtils } from "./database-service.js";
import {
  buildMasterVendorTemplate,
  getVendorRowsFromWorkbook,
  buildVendorImportPayload,
} from "./domain/vendor.module.js";
import {
  buildDefaultCpcDetailsColumnVisibility,
  loadContractColumnSettingsState,
  toggleContractColumnVisibility,
  findRowIndexByContract,
} from "./domain/contract.module.js";
import { toggleSwapExpanded } from "./domain/installment.module.js";
import {
  parseAccountingWorkbook,
  getComparisonStatusBadgeClass,
} from "./domain/report.module.js";
import {
  putContractRecord,
  saveContractFromModal,
  deleteContractCascade,
  deleteContractsCascade,
  mergeContractsFromRows,
} from "./repositories/contract.repository.js";
import {
  saveCpcWithRelations,
  deleteCpcCascade,
  upsertCpcsAndSyncDetailLinks,
  putCpcItem,
  addCpcItem,
  updateCpcItemFields,
  replaceInstallmentsForCpc,
  getAllInstallments,
} from "./repositories/cpc.repository.js";
import {
  updateInstallment,
  saveSwapInstallment,
} from "./repositories/installment.repository.js";
import {
  saveBondRecord,
  deleteBondCascade,
  deleteBondsByIds,
  renewBondRecord,
  applyBondUploadChanges,
  putBondRecord,
} from "./repositories/bond.repository.js";
import {
  saveVendorRecord,
  deleteVendorRecord,
  deleteProjectRecord,
  saveProjectRecord,
  importVendors,
  mergeVendorReferences,
} from "./repositories/vendor.repository.js";
import {
  prepareCategoryUpsert,
  upsertCategories,
  getAllCategories,
  saveCategoryRecord,
  deleteCategoriesByIds,
  seedCategoriesIfEmpty,
} from "./repositories/category.repository.js";
import {
  addDetailRowAndReorder,
  saveDetailRow,
  saveDetailRows,
  deleteDetailRowById,
  addDetailRows,
  deleteDetailRowsByIds,
  deleteDetailRowsByContract,
} from "./repositories/cpc-detail.repository.js";
import { importProjectDatasetAtomic } from "./repositories/import.repository.js";
import {
  deleteRecordsByTableIds,
  getAppStateValue,
  clearAllTables,
} from "./repositories/maintenance.repository.js";
import {
  validateContractInput,
  validateCpcInput,
  validateInstallmentInput,
  validateBondInput,
} from "./schemas/entity.schemas.js";
import { hasPermission as hasAuthPermission } from "./security/rbac.module.js";
import {
  getStoredGoogleRoleOverrides,
  storeGoogleRoleOverrides,
} from "./security/auth.module.js";
import { APP_CONFIG } from "../../../config/app.config.js";
const { Vue, XLSX, bootstrap, Fuse, html2pdf, lucide } = window;
  const app = Vue.createApp({
    data() {
      return {
        authContext: window.__X3_AUTH_CONTEXT__ || null,
        currentUserProfile: null,
        currentUserRoles: [],
        currentUserPermissions: [],
        adminAccess: {
          email: "",
          selectedRole: "x3.viewer",
          searchTerm: "",
          roleOverrides: {},
        },
        supabaseSync: {
          enabled: false,
          connected: false,
          status: "IDLE",
          reason: "",
          lastEventAt: null,
        },

        isHistoryExpanded: false,
        isContractProjectDropdownVisible: false,
        activeContractProjectIndex: -1,
        isProjectDropdownVisible: false,
        activeProjectIndex: -1,
        contractSearchTerm: "",
        isContractDropdownVisible: false,
        activeContractIndex: -1,
        isResizingNotes: false,
        notesPanelWidth: 450,
        isNotesModalVisible: false,
        isNotesEditing: false,
        currentContractNotes: [],
        activeNoteTabId: null,
        editingTabId: null,
        editingTabTitle: "",
        currentEditProject: null,
        projectModalMode: "add",
        currentEditCategory: null,
        categoryModalMode: "add",
        dataVersion: 1,
        isProjectQuickFilterVisible: false,
        projectQuickFilterSearch: "",
        activeProjectQuickFilterIndex: 0,
        invoiceSelectedRowIds: [],
        isValidationModalVisible: false,
        validationErrors: [],
        commandActions: [],
        reportCategoriesFromDB: [],
        bondModalMode: "add",
        bondContractSearchTerm: "",
        isBondContractDropdownVisible: false,
        activeBondContractIndex: -1,
        shouldFocusFirstInstallment: false,
        isSidebarFixed: localStorage.getItem("isSidebarFixed") === "true",
        timeOfDayClass: "day",
        shouldFocusPaymentDate: false,
        isQuickMenuOpen: false,
        activeQuickMenuIndex: -1,
        accountingComparisonData: null,
        cogsComparisonData: null,
        cogsSummaryFromSap: null,
        isDataLoading: true,
        isLoadingError: false,
        migrationStatus: "pending",
        lastSaveTimestamp: null,
        vendorSearchTerm: "",
        filteredVendors: [],
        isVendorDropdownVisible: false,
        activeVendorIndex: -1,
        isSidebarNavigating: false,
        sidebarNavIndex: -1,
        selectedProjectIdForBackup: null,
        projects: [],
        vendors: [],
        banks: [],
        contracts: [],
        cpcItems: [],
        installments: [],
        bonds: [],
        cpcDetailRows: [],
        currentEditVendor: null,
        vendorModalMode: "add",
        orphanData: {
          contractsWithOrphanProject: [],
          contractsWithOrphanVendor: [],
          projectsWithNoContracts: [],
          installmentsWithOrphanCpc: [],
          bondsWithOrphanCpc: [],
          cpcWithOrphanContract: [],
        },

        activeHelpTopic: "getting-started",
        isCommandPaletteVisible: false,
        isSearching: false,
        commandSearchTerm: "",
        commandSearchResults: [],
        activeCommandIndex: 0,
        fuseInstance: null,
        fuseIndex: null,
        debouncedSearch: null,

        viewStates: {
          vendorPartner: {
            searchTerm: "",
            selectedId: null
          },
          viewMode: "contract",
          invoiceAging: {
            viewMode: "contract",
            sortBy: "contractNo",
            sortDirection: "asc",
            currentPage: 1,
            perPage: 10,
            isFilterCollapsed: true,
            filter: {
              projectId: [],
              vendorId: [],
              minAge: 0,
              projectSearch: "",
              vendorSearch: "",
              reportDate: new Date().toISOString().slice(0, 10),
              expansion: {
                project: false,
                vendor: false,
              },
            },
          },
          cpcTracking: {
            sortBy: "receivedDate",
            sortDirection: "desc",
            currentPage: 1,
            perPage: 7,
            searchTerm: "",
            isActionCenterCollapsed: true,
            filter: {
              projectId: [],
              vendorId: [],
              contractId: [],
              status: [],
              projectSearch: "",
              vendorSearch: "",
              contractNoSearch: "",

              expansion: {
                project: false,
                vendor: false,
                contract: false,
                status: false,
              },
            },
            isFilterCollapsed: true,
          },
          cpcDetails: {
            activePhaseId: "summary",
            filter: {
              projectId: [],
              vendorId: [],
              selectedContractId: null,
              projectSearch: "",
              vendorSearch: "",

              expansion: {
                project: false,
                vendor: false,
                contract: false,
              },
            },
            currencyView: "VND",
            columnVisibility: {},
            subColumnVisibility: {},
            isFilterCollapsed: true,
          },
          vendorBalance: {
            sortBy: "vendorName",
            sortDirection: "asc",
            currentPage: 1,
            perPage: 7,
            searchTerm: "",
            filter: {
              projectId: [],
              projectSearch: "",
              status: [],
              balanceStatus: null,
              asOfDate: null,

              expansion: {
                project: false,
                balanceStatus: false,
                status: false,
              },
            },
            isFilterCollapsed: false,
          },
          paymentDashboard: {
            sortBy: "date",
            sortDirection: "desc",
            currentPage: 1,
            perPage: 7,
            filter: {
              startDate: "",
              endDate: "",
              projectId: [],
              vendorId: [],
              code: [],
              paymentSource: [],
              projectSearch: "",
              vendorSearch: "",
              codeSearch: "",
              paymentSourceSearch: "",

              expansion: {
                project: false,
                vendor: false,
                code: false,
                paymentSource: false,
              },
            },
            isFilterCollapsed: true,
          },
          swapDashboard: {
            sortBy: "swapDueDatePayment",
            sortDirection: "asc",
            currentPage: 1,
            perPage: 7,
            filter: {
              projectId: [],
              vendorId: [],
              vendorSWAP: [],
              projectSearch: "",
              vendorSearch: "",
              vendorSWAPSearch: "",

              expansion: {
                project: false,
                vendor: false,
                vendorSWAP: false,
              },
            },
            isFilterCollapsed: true,
          },
          bondDashboard: {
            sortBy: "expiryDate",
            sortDirection: "asc",
            currentPage: 1,
            perPage: 7,
            expandedGroupKeys: [],
            filter: {
              projectId: [],
              vendorId: [],
              contractId: [],
              bondType: [],
              status: [],
              projectSearch: "",
              vendorSearch: "",
              contractNoSearch: "",
              typeSearch: "",

              expansion: {
                project: false,
                vendor: false,
                contract: false,
                bondType: false,
              },
            },
            isFilterCollapsed: true,
          },
          contractDashboard: {
            sortBy: "date",
            sortDirection: "desc",
            currentPage: 1,
            perPage: 7,
            filter: {
              projectId: [],
              vendorId: [],
              contractId: [],
              code: [],
              projectSearch: "",
              vendorSearch: "",
              contractNoSearch: "",
              codeSearch: "",

              expansion: {
                project: false,
                vendor: false,
                contract: false,
                code: false,
              },
            },
            isFilterCollapsed: true,
          },
          reportDashboard: {
            asOfDate: new Date().toISOString().slice(0, 10),
            reportMonth: new Date().toISOString().slice(0, 7),
            filter: {
              projectId: [],
              projectSearch: "",

              expansion: {
                project: false,
              },
            },
          },
          cogsDashboard: {
            sortBy: "glAccount",
            sortDirection: "asc",
            currentPage: 1,
            perPage: 10,
            filter: {
              projectId: [],
              status: [],
              projectSearch: "",

              expansion: {
                project: false,
                status: false,
              },
            },
            isFilterCollapsed: false,
          },
        },
        currentEditItem: null,
        modalMode: "edit",
        currentEditContract: null,
        contractModalMode: "add",
        currentViewBondItem: null,
        currentEditInstallment: null,
        currentEditSwap: null,
        currentEditBond: null,
        currentStatusUpdate: null,
        isSidebarCollapsed: false,
        currentTab: "cpc-tracking",
        masterData: {
          activeSubTab: "vendors",

          vendors: {
            searchTerm: "",
            currentPage: 1,
            perPage: 10,
          },
          projects: {
            searchTerm: "",
            currentPage: 1,
            perPage: 10,
          },
        },
        highlightedRowId: null,
        toasts: [],
        confirmation: {
          title: "",
          message: "",
          onConfirm: null,
          confirmButtonText: "Confirm",
          confirmButtonClass: "btn-danger",
          onNeutral: null,
          neutralButtonText: "Continue",
        },
        language: "vi",
        transitionName: "slide-fade",
        expandedNotificationIds: [],
        editingCell: { itemId: null, field: null },
        inlineEditValue: "",
        justEditedCell: { itemId: null, field: null },
        showScrollToTopButton: false,
        translations: {
          en: {
            actionCenterTitle: "CPC Action Center",
            overdueRecently: "Overdue Recently",
            allStable: "All systems stable",
            showDetails: "SHOW DETAILS",
            collapse: "COLLAPSE",
            noOverdueRecords: "No overdue records found.",
            noPartialRecords: "No partial payment records found.",
            noUpcomingRecords: "No upcoming records within 10 days.",
            daysLate: "{days} days late",
            daysRemaining: "{days} days remaining",
            remainingLabel: "Remaining",
            swapLabel: "SWAP",
            offsetLabel: "Offset",
            vendorpartner: "Vendor Partners",
            contractoverview: "Contract Overview",
            contactPerson: "Contact Person",
            phoneNumber: "Phone Number",
            vendorPartner: "Vendor Partners",
            vendorSearchHint: "Name, Tax ID...",
            startSearchPrompt: "Enter vendor name or ID to start...",
            noResultsFound: "No matching results found.",
            selectVendorPrompt: "Please select a vendor to view data",
            activeContracts: "Active Contracts",
            joinedProjects: "Participating Projects",
            cpcOutstanding: "CPC OUTSTANDING",
            advBalance: "ADVANCE BALANCE",
            retentionHeld: "RETENTION HELD",
            workProgress: "WORK PROGRESS",
            retentionPool: "Retention Pool",
            unrecovered: "Unrecovered",
            contractProjectHeader: "CONTRACT & PROJECT",
            contractValueHeader: "CONTRACT VALUE",
            confirmedCpc: "CONFIRMED CPC",
            acceptanceShort: "Acc.", // Viết tắt cho Acceptance (Nghiệm thu)
            advBalShort: "Adv. Bal", // Viết tắt cho Advance Balance
            cpcOutstanding: "CPC OUTSTANDING",
            advBalance: "ADVANCE BALANCE",
            retentionHeld: "RETENTION HELD",
            performance: "WORK PROGRESS",
            vendorPartner: "Vendor Partners",
            vendorSearchHint: "Name, Tax ID...",
            totalCommitted: "TOTAL COMMITTED LIMIT",
            performance: "PERFORMANCE",
            disbursedNet: "DISBURSED (NET)",
            retentionHeld: "RETENTION HELD",
            contractList: "Detailed Contract List",
            confirmedAmount: "Confirmed / Paid",
            activeVendor: "Active Vendor",
            retentionPool: "Retention Pool",
            initialAdvance: "Initial Advance",
            additionalAdvance: "Additional Advance",
            currentAdvanceBalance: "Current Advance Balance",
            processing: "Processing",
            contractOverview: "Contract Overview",
            vendorPartner: "Vendor Partner",
            mainContract: "MAIN CONTRACT",
            totalValue: "Total Value",
            duration: "Duration",
            acceptanceProgress: "ACCEPTANCE PROGRESS",
            totalPaidHeader: "TOTAL PAID",
            totalPaidNote: "Total disbursed amount (Incl. VAT)",
            advanceBalanceHeader: "ADVANCE BALANCE",
            retentionValueHeader: "RETENTION VALUE",
            budget: "Budget",
            advanceFlow: "Advance Flow",
            totalRecovered: "Total Recovered/Repayment",
            toRecover: "To be recovered",
            paymentHistory: "Payment History",
            cpcStatusGroup: "CPC / Status Group",
            summaryPaid: "TOTAL COMPLETED PAYMENTS",
            summaryProcessing: "TOTAL PENDING/PARTIAL PAYMENTS",
            backToDetails: "Back to CPC Details",
            viewOverviewMode: "View Overview (2 rows)",
            viewDetailedMode: "View Detailed (Each CPC)",
            bondEffective: "Bond Information (Active)",
            noBonds: "No active bonds for this contract.",
            agingReportDate: "Calculate aging to",
            viewByInvoice: "By Invoice",
            viewByContract: "By Contract (CPC)",
            age1_30: "1-30 Days",
            age31_60: "31-60 Days",
            age61_90: "61-90 Days",
            ageOver90: "> 90 Days",
            totalOverdue: "Total Overdue",
            invoiceNet: "Net Amount",
            invoiceVat: "VAT",
            invoiceTotal: "Total Amount",
            contractDateLabel: "Contract Date",
            descriptionLabel: "Description",
            btnExportExcel: "Export Excel",
            promptSelectProjectAging:
              "Please select a Project to view aging data",
            noAgingData: "No overdue data found up to {date}",
            calculatingData: "Recalculating all data...",
            refreshSuccess: "Data refreshed successfully!",
            phaseRowsInitialized:
              "Empty rows initialized for the new phase.",
            errorUploadInSummaryMode:
              "You are in Summary view. Please select a specific Phase tab to upload data.",
            phaseAddedSuccess: "New phase added successfully.",
            phaseRenamedSuccess: "Phase renamed successfully.",
            phaseDeletedSuccess: "Phase and related data deleted.",
            phaseDeleteError: "System error while deleting data.",
            filteringBondForContract:
              "Filtering expiring/overdue bonds for contract: {contractNo}",
            vendorNoContractWarning:
              "This vendor has no contracts in the system (Accounting only).",
            filteringContractForVendor:
              "Filtering contracts for: {vendorName}",
            errorDateInvalidField:
              "Invalid date '{dateStr}' for field '{field}'. Please use date between 2010-2040.",
            errorDateInvalidInstallment:
              "Dates in payment installments are invalid (must be 2010-2040).",
            errorPaymentExceedsDetailsNegative:
              "Offset value ({totalPaid}) is invalid for receivable amount ({cpcAmount}). Please enter a positive value not exceeding {absAmount}.",
            errorContractNotFound: "Error: Original contract not found.",
            rowAddedSuccess: "New row added.",
            rowAddError: "Could not add new row.",
            errorNoRowsToUpdateInvoice: "No rows found to update invoice.",
            dataAppendedSuccess: "Data appended to {phaseName}.",
            dataAppendError: "Error appending data.",
            dataOverwrittenSuccess: "Data overwritten for {phaseName}.",
            noValidDataFound: "No valid data found in the file.",
            resyncStarted: "Starting data check and synchronization...",
            resyncComplete:
              "Complete! Checked and updated {count} records.",
            resyncError: "An error occurred during synchronization.",
            errorSelectContractToExport:
              "Please select a contract to export.",
            errorNoDetailDataToExport: "No detail data to export.",
            exportDetailsSuccess: "Details exported successfully.",
            errorProjectNameRequired: "Please enter Project Name.",
            errorProjectNameExists: "Project name '{name}' already exists.",
            projectAddSuccess: "New project added successfully!",
            projectUpdateSuccess: "Project updated successfully!",
            projectSaveError: "Failed to save project.",
            warningMismatchVatPayment:
              "VAT Payment ({paid}) >= Invoice VAT ({invoice}). Row skipped.",
            historyRecord: "History Rec",
            settledStatus: "Settled",
            viewDetails: "View Details",
            renewalHistoryTooltip: "Renewal History",
            quickSettleTooltip: "Toggle Quick Settle status",
            bondSettled: "Settled",
            tabInvoiceAging: "Invoice Aging",
            invoiceFilterTitle: "Invoice Filters",
            ageDays: "Age (Days)",
            filterOverdueDays: "Filter overdue days >",
            daysUnit: "days",
            remainingNet: "Remaining Net",
            remainingVat: "Remaining VAT",
            remainingTotal: "Remaining Total",
            promptSelectProjectForAging:
              "Please select a Project to view invoice aging",
            promptSelectProjectForAgingDesc:
              "Select 'Show Filters' -> 'Project' to start.",
            noInvoiceAgingData: "No matching invoice aging data found.",
            invoiceNoLabel: "Invoice No.",
            sidebarPin: "Pin Sidebar",
            sidebarUnpin: "Auto Collapse",
            swapProduct: "SWAP Product",
            generalNotes: "General Notes",
            addNoteTab: "Add a new note tab",
            promptNewTabTitle: "Please enter a title for the new tab:",
            promptAddNoteTab: "Add a new tab to start writing notes.",
            confirmDeleteTabTitle: "Delete Tab",
            confirmDeleteTabMessage:
              "Are you sure you want to delete the tab {title}? All content in this tab will be lost.",

            significantNotes: "Significant Notes",
            viewEditNotes: "View/Edit",
            significantNotesTitle: "Significant Payment Notes",
            notesPlaceholder: "Enter contract payment conditions here...",
            noNotesAvailable: "No notes available.",
            btnExportVendors: "Export Vendors",
            btnUploadCategories: "Upload Categories",
            categoryUploadSuccess:
              "Successfully processed {added} new and {updated} updated categories.",
            categoryUploadSkipped:
              "Skipped {skipped} rows due to missing data or errors.",
            errorNoCategoryDataToExport: "No category data to export.",
            categoryExportSuccess: "Categories exported successfully!",
            categoryTab: "Report Categories",
            addCategory: "Add Category",
            categoryTableHeaderNo: "No.",
            categoryTableHeaderCode: "Code",
            categoryTableHeaderNameVi: "Vietnamese Name",
            categoryTableHeaderNameEn: "English Name",
            categoryTableHeaderUsage: "Contracts Using",
            categoryTableNoData: "No categories found.",
            categoryModalAddTitle: "Add New Category",
            categoryModalEditTitle: "Edit Category",
            categoryParentLabel:
              "Parent Category (Leave empty for Level 1)",
            categoryParentOption: "-- Is a parent category (Level 1) --",
            categoryCodeLabel: "Category Code",
            categoryCodeReadonly: "Code cannot be changed after creation.",
            categoryNameViLabel: "Vietnamese Name",
            categoryNameEnLabel: "English Name",
            errorCategoryRequired: "Code and Vietnamese Name are required.",
            errorCategoryCodeExists:
              "Category code '{code}' already exists.",
            categoryAddSuccess: "New category added successfully!",
            categoryUpdateSuccess: "Category updated successfully!",
            categorySaveFailed: "Failed to save category.",
            errorCategoryInUse:
              "Cannot delete a category that is in use by one or more contracts.",
            confirmDeleteCategory:
              "Are you sure you want to delete the category <strong>{code} - {name}</strong>?",
            warningDeleteParentCategory:
              "<strong>WARNING:</strong> This is a parent category. All <strong>{count}</strong> child categories will also be deleted.",
            errorDeleteParentInUse:
              "Cannot delete parent category because one of its child categories is in use.",
            categoryDeleteSuccess: "Category deleted successfully.",
            categoryDeleteFailed: "Failed to delete category.",
            confirmSendCpcTitle: "Confirm CPC Send",
            confirmUpdateCpcMessage:
              "CPC <strong>{cpcNo}</strong> already exists. Do you want to update its value to <strong>{amount}</strong> based on the sum of the detail rows?",
            btnUpdate: "Update",
            confirmSendCpcMessage:
              "Are you sure you want to send CPC <strong>{cpcNo}</strong> with a total value of <strong>{amount}</strong>?",
            btnSend: "Send",
            editProject: "Edit Project",
            validationErrorTitle: "Excel File Validation Errors",
            validationErrorIntro:
              "The file could not be imported because the following errors were found. Please correct them in your Excel file and try again:",
            validationSheet: "Sheet",
            validationRow: "Row",
            validationMessage: "Error Message",
            validationErrorRequired:
              "Required field '<strong>{field}</strong>' is empty.",
            validationErrorNoContract:
              "Contract '<strong>{contractNo}</strong>' does not exist in the system's Master Data.",
            validationErrorDuplicate:
              "A CPC with this number for this contract already exists (either in the database or duplicated in the file).",
            validationErrorOrphaned:
              "This installment is orphaned: its parent CPC was not found or was invalid in the 'CPC_Main' sheet.",
            cpcUploadSuccess:
              "Successfully added {cpcCount} CPCs and {instCount} installments.",
            uploadSkipped: "Skipped {count} rows due to errors.",
            uploadSkippedReasonMissingData:
              "Missing required 'contractNo' or 'cpc'.",
            uploadSkippedReasonNoContract:
              "Contract '{contractNo}' not found in Master Data.",
            uploadSkippedReasonDuplicate:
              "CPC for this contract already exists (in DB or file).",
            uploadSkippedReasonOrphaned:
              "Orphaned installment: its parent CPC was not found or was invalid in the file.",
            confirmSettleTitle: "Confirm Settlement",
            confirmCancelSettleTitle: "Confirm Cancel Settlement",
            confirmSettleMessage:
              "Are you sure you want to settle bond <strong>{bondNumber}</strong>?",
            confirmCancelSettleMessage:
              "Are you sure you want to cancel the settlement status for bond <strong>{bondNumber}</strong>?",
            btnConfirmSettle: "Settle",
            btnConfirmCancelSettle: "Cancel Settlement",
            bondSettledSuccess: "Bond '{bondNumber}' has been settled.",
            bondUnsettledSuccess:
              "Settlement for bond '{bondNumber}' has been canceled.",
            errorFindBondToUpdate:
              "Error: Could not find the bond to update.",
            errorUpdateBondStatus: "Could not update bond status.",
            tooltipBondRenewed: "Renewed, cannot be changed.",
            tooltipBondCancelSettle: "Click to cancel settlement.",
            tooltipBondQuickSettle: "Click to quick settle.",
            btnUploadBonds: "Upload Bonds",
            btnExportBonds: "Export Bonds",
            errorNoBondDataToExport: "No bond data to export.",
            bondExportSuccess: "Bond data exported successfully!",
            bondUploadSuccess: "Successfully added {count} new bonds.",
            bondUploadNone: "No new bonds were added.",
            bondUploadSkipped: " Skipped {count} rows due to errors.",
            bondUploadReasonMissingData: "Missing Contract No. or Bond No.",
            bondUploadReasonExists: "Bond Number already exists.",
            bondUploadReasonNoContract:
              "Contract '{contractNo}' not found.",
            bondUploadSkippedConsole: "Skipped bonds:",
            excelHeaderContract: "Contract",
            excelHeaderBondNumber: "Bond Number",
            excelHeaderReference: "Reference",
            excelHeaderBondType: "Bond Type",
            excelHeaderAmount: "Amount",
            excelHeaderIssueDate: "Issue Date",
            excelHeaderExpiryDate: "Expiry Date",
            excelHeaderBank: "Bank",
            excelHeaderStatus: "Status",
            appTitle: "CPC Vision",
            toggleLanguage: "Toggle Language",
            btnClose: "Close",
            btnSaveChanges: "Save Changes",
            btnCancel: "Cancel",
            confirm: "Confirm",
            warning: "Warning",
            areYouSure: "Are you sure?",
            actionCannotBeUndone: "This action cannot be undone.",
            allFiltersCleared: "All filters have been cleared.",
            activeFilters: "Active Filters",
            editFilters: "Edit Filters",
            noActiveFilters: "No active filters.",
            filterPanelTitle: "Filter Controls",
            search: "Search",
            columns: "Columns",
            subColumns: "Sub-columns",
            total: "Total",
            grandTotal: "GRAND TOTAL",
            footerRemaining: "Remaining",
            status: "Status",
            action: "Action",
            saveChanges: "Save Changes",
            saved: "Saved",
            unsaved: "Unsaved",
            unsavedChangesTooltip:
              "You have unsaved changes. Click the button to save.",
            savedStatusTooltip: "All changes are saved to your browser.",
            guideTitle: "Application User Guide",
            print: "Print",
            viewAs: "View as",
            configure: "Configure",
            banks: "Banks",
            ok: "OK",
            na: "N/A",
            calculationRules: "Calculation Rules",
            repaymentThresholdLabel: "Repayment Threshold (%)",
            repaymentThresholdNote: "Default: 80%.",
            retentionRateLabel: "Retention Rate (%)",
            retentionRateNote: "Default: 5%.",
            defaultVatRateLabel: "Default VAT Rate (%)",
            defaultVatRateNote: "Default: 8%.",
            hide: "Hide",
            change: "Change",
            tabCpcTracking: "CPC Tracking",
            cpctracking: "CPC Tracking",
            tabCpcDetails: "CPC Details",
            cpcdetails: "CPC Details",
            tabVendorBalance: "Vendor Balance",
            vendorbalance: "Vendor Balance",
            tabPaymentDashboard: "Payment",
            cpcdashboard: "Payment Dashboard",
            tabSwapDashboard: "SWAP",
            cpcswapdashboard: "SWAP Dashboard",
            tabBondDashboard: "Bond",
            cpcbonddashboard: "Bond Dashboard",
            tabContractDashboard: "Contract",
            cpccontractdashboard: "Contract Dashboard",
            tabReportDashboard: "Report",
            cpcreportdashboard: "Report Dashboard",
            tabCogsDashboard: "COGS",
            cogsdashboard: "COGS Dashboard",
            masterdata: "Master Data",
            btnAddCpc: "Add CPC",
            btnAddContract: "Add Contract",
            btnAddBond: "Add Bond",
            btnUploadContracts: "Upload Contracts",
            btnData: "Data",
            btnTemplate: "Template",
            btnUpload: "Upload from Excel",
            btnUploadMerge: "Upload & Merge",
            btnExport: "Export to Excel",
            btnExportJson: "Export to JSON",
            btnSaveToFile: "Backup to File",
            btnOpenFile: "Restore from File",
            btnClearAll: "Clear All",
            btnClearAllFilters: "Clear All Filters",
            btnEdit: "Edit",
            btnAdd: "Add",
            btnRenew: "Renew",
            btnDelete: "Delete",
            btnPrevious: "Previous",
            btnNext: "Next",
            btnDownloadDetailsTemplate: "Details Template",
            btnUploadDetails: "Upload Details",
            btnExportDetails: "Export Details",
            btnBackupProject: "Backup Project",
            btnImportProject: "Import Project",
            btnBackup: "Backup",
            btnRestore: "Restore",
            btnUploadReconcile: "Upload & Reconcile Accounts",
            btnClear: "Clear",
            btnDebugVendor: "Debug Vendor by No.",
            btnUploadCogs: "Upload & Reconcile COGS",
            btnClearCogs: "Clear Reconciliation",
            btnAddVendor: "Add Vendor",
            btnDownloadTemplate: "Download Template",
            btnCleanupData: "Cleanup Data",
            btnAddProject: "Add Project",
            btnAddBank: "Add Bank",
            btnClearVisibleContracts: "Delete Visible Contracts",
            btnClearVisibleBonds: "Delete Visible Bonds",
            showEntriesLabel: "Show:",
            entriesUnit: "entries",
            searchPlaceholder: "Search...",
            clearSearchTooltip: "Clear search",
            tableHeaderNo: "No.",
            tableHeaderAction: "Action",
            noMatchingData: "No data matches the current filters.",
            paginationInfo: "Showing {start} to {end} of {total} entries",
            paginationPageInfo: "Page {currentPage} / {totalPages}",
            project: "Project",
            vendor: "Vendor",
            code: "Code",
            glaccount: "G/L Account",
            contract: "Contract",
            date: "Date",
            postingDate: "Posting Date",
            currency: "Currency",
            bondType: "Bond Type",
            dateRange: "Date Range",
            startDate: "Start Date",
            endDate: "End Date",
            searchProjects: "Search projects...",
            searchVendors: "Search vendors...",
            searchCodes: "Search codes...",
            searchContracts: "Search contracts...",
            searchTypes: "Search types...",
            searchPaymentSources: "Search payment sources...",
            tooltipClearFilter: "Clear filter",
            tooltipResetDate: "Reset date range",
            cpc: "CPC",
            contents: "Contents",
            department: "Department",
            contractSystemNo: "Contract System No.",
            vendorNo: "Vendor No.",
            amountInclVAT: "Amount (Incl. VAT)",
            receivedDate: "Received Date",
            paymentDueDate: "Payment Due Date",
            amountPaid: "Amount Paid",
            paymentDate: "Payment Date",
            lineTracking: "Line tracking",
            notes: "Notes",
            installment: "Installment",
            bond: "Bond",
            moreInfo: "More Info",
            installment_ordinal: "Inst. {num}{ordinal}",
            installment_swap: "Inst. {num}{ordinal}",
            noPaymentsAvailable: "No payments are available.",
            tooltipEdit: "Edit",
            tooltipCopy: "Copy",
            tooltipDelete: "Delete",
            complete: "Complete",
            partialpayment: "Partial Payment",
            pending: "Pending",
            completeswap: "Complete SWAP",
            partialswap: "Partial SWAP",
            completeswappayment: "Complete SWAP Payment",
            partialswappayment: "Partial SWAP Payment",
            status_overdue_days: "{days} days overdue",
            status_due_today: "Due Today",
            status_days_left: "{days} days left",
            completeWithOffset: "Complete (Offset)",
            swap: "SWAP",
            swapPayments: "SWAP Payments",
            addSwapPayment: "Add SWAP Payment",
            swapPaidLabel: "SWAP Paid",
            vendorSWAP: "SWAP Vendor",
            swapAgreement: "SWAP Agreement",
            agreementDate: "Agreement Date",
            swapInformation: "SWAP Information",
            swapDueDatePayment: "SWAP Due Date Payment",
            swapAmountPaid: "SWAP Amount Paid",
            paidStatus: "Paid",
            unpaidStatus: "Unpaid",
            collected: "Collected",
            partiallyCollected: "Partially Collected",
            uncollected: "Uncollected",
            swapPaymentDate: "Swap Payment Date",
            duebond: "Due Bonds",
            bondNumber: "Bond Number",
            ref: "Ref.",
            issueDate: "Issue Date",
            expiryDate: "Expiry Date",
            issuingBank: "Issuing Bank",
            quickSettle: "Quick Settle",
            bond_status_overdue: "Overdue by {days} days",
            bond_status_expiring: "Expiring in {days} days",
            bond_status_active: "Active",
            renewedStatus: "Renewed",
            noExpenseData: "No expense data matches the current filters.",
            noBondData: "No bond data matches the current filters.",
            noSwapData: "No SWAP data matches the current filters.",
            gl3311: "Payable to Supplier",
            gl3312: "Advance to Supplier",
            outstandingBalanceStatus: "Outstanding Balance Status",
            balanceStatusHasBalance: "Payable/Advance ≠ 0",
            fullySettled: "Payable & Advance = 0",
            reportAsOf: "Report as of",
            reportAsOfNote: "Leave blank to view the current balance.",
            payableSap: "Payable (SAP)",
            advanceSap: "Advance (SAP)",
            difference: "Difference",
            statusMatch: "Match",
            statusMismatch: "Mismatch",
            statusOnlyinApp: "Only in App",
            statusOnlyinAccounting: "Only in Accounting",
            cogsSummaryTitle: "Summary by G/L Account",
            cogsDetailTitle: "Contract Details for Reconciliation",
            invAmountApp: "Inv. Amount (App)",
            invAmountSap: "Inv. Amount (SAP)",
            reconciliationStatus: "Status",
            transactionType: "Transaction Type",
            transactionTypeReceivable: "Debt Collection",
            transactionTypePayable: "Payable Payment",
            modalTitleEdit: "Edit CPC Item",
            modalTitleCopy: "Copy CPC Item",
            modalTitleAdd: "Add New CPC Item",
            modalTitleEditFinancials: "Edit Financials & Payments",
            modalTitleAddContract: "Add New Contract",
            modalTitleEditContract: "Edit Contract",
            modalTitleAddVendor: "Add New Vendor",
            editVendor: "Edit Vendor",
            modalTitleEditInstallment: "Edit Payment",
            modalTitleEditContractDetail: "Edit Contract Details",
            modalTitleEditCpcDetail: "Edit CPC Details",
            modalTitleEditPaymentDetail: "Edit Payment Details",
            modalTitleEditInvoiceDetail: "Edit Invoice Details",
            editSwapTitle: "Edit SWAP Details",
            modalSectionMain: "Main Information",
            modalSectionFinancial: "Financials & Dates",
            modalSectionSystem: "System Information",
            amountExclVAT: "Amount (Excl. VAT)",
            vatAmount: "VAT",
            amountUSD: "Amount USD",
            exchangeRate: "Exchange Rate",
            invoiceExchangeRate: "Invoice Exchange Rate",
            paymentInUSD: "Pay in USD",
            paymentInstallments: "Payment Installments",
            paymentSource: "Payment Source",
            addInstallment: "Add Installment",
            bondInformation: "Bond Information",
            selectBondType: "Select Bond Type",
            prepaymentBond: "Prepayment Bond",
            performanceBond: "Performance Bond",
            warrantyBond: "Warranty Bond",
            addBond: "Add Bond",
            bondDetailsFor: "Bond Details for",
            noBondInfo: "No bond information is available for this item.",
            updateBondStatus: "Update Bond Status",
            statusUpdate: "Status Update",
            advancePaymentsCleared: "Advance payments fully cleared",
            contractSettled: "The contract has been settled",
            otherReason: "Other reason",
            inputCustomReason: "Input custom reason",
            renewBond: "Renew Bond",
            originalBondNumber: "Original Bond Number",
            originalBondType: "Original Bond Type",
            originalExpiryDate: "Original Expiry Date",
            originalAmount: "Original Amount",
            newRenewalDetails: "New Renewal Details",
            newBondNumber: "New Bond Number",
            newBondType: "New Bond Type",
            newAmount: "New Amount",
            newIssueDate: "New Issue Date",
            newExpiryDate: "New Expiry Date",
            newIssuingBank: "New Issuing Bank",
            renewalNotes: "Renewal Notes",
            btnSaveRenewal: "Save Renewal",
            updateContractStatus: "Update Contract Status",
            active: "Active",
            closed: "Closed",
            statusNote: "Status Note",
            selectContract: "Select Contract",
            promptSelectContract:
              "Please select one project and one vendor",
            pleaseSelectContractToView:
              "Please select a contract to view or enter data.",
            loadFromXml: "Load from XML",
            addNewRow: "Add New Row",
            deleteRow: "Delete Row",
            deleteContents: "Clear Contents",
            contractinfo: "Contract Info",
            details: "Description",
            amount: "Amount",
            net: "Net",
            vat: "VAT",
            repaymentBasisTitle:
              "Select Contract/VON values for repayment calculation",
            noBasisAvailable:
              "No Contract/VON values found in previous or current rows.",
            calcRepayOnWorkdone: "Repayment on Work-done",
            finalSettlement: "Final Settlement",
            distributeToCpcRows: "Distribute to CPC rows:",
            columnGroupContract: "Contract",
            columnGroupCpc: "CPC",
            columnGroupPayment: "Payment",
            columnGroupInvoice: "Invoice",
            columnGroupRemainingPayable: "Remaining Payable",
            columnGroupContractRemaining: "Contract Remaining",
            reportAsOfDate: "As of Date",
            reportMonth: "Report Month",
            category: "Category",
            reportPaidToDateHeader: "Paid up to {date}",
            reportRemainingFromDateHeader: "Remaining from {date}",
            reportPaidInMonthHeader: "Paid in {month}",
            vendor_tab: "Vendor",
            project_tab: "Project",
            banks_tab: "Banks",
            abbreviation: "Abbreviation",
            contractCount: "No. Contract",
            searchVendorPlaceholder: "Search Vendor...",
            noVendorsFound: "No vendors found.",
            searchProjectPlaceholder: "Search Project...",
            projectContractCount: "No. Contracts related to Project",
            noProjectsFound: "No projects found.",
            searchBankPlaceholder: "Search Bank...",
            bankContractCount: "No. Bonds Issued",
            noBanksFound: "No banks found.",
            commandPalettePlaceholder: "Search Contract, CPC, Vendor...",
            commandPaletteNoResults: "No results found.",
            cpc_search: "CPC",
            contract_search: "CONTRACT",
            notificationHeader: "Bond Notifications",
            noNotifications: "No bonds are expiring soon or overdue.",
            changesSavedSuccess: "Changes saved successfully.",
            errorPaymentDate:
              "Payment date is required for installments with an amount greater than zero.",
            errorPostingDateRequired:
              "Posting Date is required to save the invoice.",
            errorPaymentExceedsDetails:
              "Total payment ({totalPaid}) exceeds the CPC amount ({cpcAmount}) by {overExcessAmount}.",
            contractCreatedAutomatically:
              "A new contract has been automatically created in the master list.",
            confirmDeletion: "Confirm Deletion",
            confirmDeleteCpcItem:
              "Are you sure you want to delete CPC item <strong>{cpc}</strong>? This action cannot be undone.",
            confirmDeleteRow:
              "Are you sure you want to delete this entire row?",
            itemDeleted: "Item deleted successfully.",
            rowDeleted: "Row deleted successfully.",
            confirmClearAllData:
              "This will permanently delete all CPC and Contract data. Are you sure you want to proceed?",
            yesClearAll: "Yes, Clear All",
            allDataCleared: "All application data has been cleared.",
            fileSaveSuccess: "Data file saved successfully.",
            confirmDataLoad: "Confirm Data Load",
            confirmOverwriteData:
              "This will overwrite all current unsaved data with the content from the file. Are you sure?",
            loadSuccess: "Data has been loaded successfully.",
            invalidJsonFormat: "Invalid JSON file format.",
            errorParsingJson: "Error parsing the JSON file.",
            errorInvalidExcelFile:
              "Invalid file type. Please upload an .xlsx or .xls file.",
            itemsUploaded: "{count} items were successfully uploaded.",
            noValidItems:
              "No new valid items were found in the file to upload.",
            errorProcessingExcel:
              "An error occurred while processing the Excel file.",
            errorContractNumberRequired:
              "Contract Number is a required field.",
            errorContractExists:
              "A contract with this number already exists in the master list.",
            contractSavedSuccess: "Contract saved successfully.",
            confirmDeleteContract:
              "Are you sure you want to delete contract <strong>{contractNo}</strong>? This action cannot be undone.",
            contractDeletedSuccess:
              "Contract has been deleted successfully.",
            errorUpdatingPayment:
              "Error: Could not find the original payment to update.",
            confirmDeleteBond:
              "Are you sure you want to delete bond <strong>{bondNumber}</strong>?",
            bondDeletedSuccess: "The bond has been deleted successfully.",
            errorFindBondToDelete:
              "Error: Could not find the specific bond to delete.",
            errorFindOriginalCpcItem:
              "Error: Could not find the original CPC item for this operation.",
            errorNewBondDates:
              "The new issue date and expiry date are required for bond renewal.",
            bondRenewedSuccess:
              "The bond has been successfully renewed and a new bond entry has been added.",
            bondInfoSaved: "Bond information has been saved.",
            cpcSentToTracking: "CPC has been sent to the Tracking tab.",
            cpcUpdatedInTracking:
              "CPC has been updated in the Tracking tab.",
            cpcPaymentUpdatedInDetails:
              "Payment information has been updated in the CPC Details tab.",
            errorNoDataToSend: "No CPC data available on this row to send.",
            paymentManagedInTracking:
              "Payment details are managed in the CPC Tracking tab.",
            detailsDataUploaded:
              "Details data for contract {contractNo} has been successfully updated.",
            confirmOverwriteDetails:
              "This will replace all existing details for contract <strong>{contractNo}</strong> with data from the file. Are you sure?",
            contractStatusUpdated: "Contract status updated successfully.",
            btnClearVisibleBonds: "Delete Visible Bonds",
            btnClearVisibleContracts: "Delete Visible Contracts",
            confirmClearVisibleBonds:
              "Are you sure you want to delete the <strong>{count}</strong> currently visible bonds? This action cannot be undone.",
            confirmClearVisibleContracts:
              "Are you sure you want to delete the <strong>{count}</strong> currently visible contracts? This action cannot be undone.",
            visibleBondsCleared: "{count} bonds have been deleted.",
            visibleContractsCleared: "{count} contracts have been deleted.",
            cogsReconciliationCleared:
              "COGS reconciliation data has been cleared.",
            cogsUploadSuccess:
              "Upload successful! Processed {count} data rows.",
            accountingReconciliationCleared:
              "Reconciliation data has been deleted.",
            accountingUploadSuccess:
              "Upload successful! Processed {count} vendor codes from the file.",
            projectDeletedSuccess: "Project deleted successfully.",
            projectDeleteFailed: "Failed to delete project.",
            vendorDeletedSuccess: "Vendor deleted successfully.",
            vendorDeleteFailed: "Failed to delete vendor.",
            errorProjectVendorRequired:
              "Please enter complete Project and Vendor information.",
            errorSavingCpc: "Failed to save CPC data.",
            vendorSavedSuccess: "Vendor information saved successfully!",
            vendorSaveFailed: "Failed to save vendor.",
            errorVendorNameRequired: "Please enter a Vendor name.",
            errorVendorNoRequired: "Please enter a Vendor No.",
            errorVendorNameExists: "Vendor '{vendorName}' already exists.",
            errorVendorNoExists: "Vendor No. '{vendorNo}' already exists.",
            errorLoadingFromDb:
              "Unable to load data from browser database.",
            errorSavingChanges: "Failed to save changes.",
            errorSheetNotFound:
              "Sheet '{sheetName}' not found in the Excel file.",
            errorNoValidDataInExcel:
              "No valid data found in the Excel file.",
            errorVendorInUse:
              "Cannot delete a vendor that is currently in use in contracts.",
            errorProjectInUse:
              "Cannot delete a project that is currently in use in contracts.",
            confirmDeleteVendorMessage:
              "Are you sure you want to delete the Vendor '<strong>{vendorName}</strong>'? This action cannot be undone.",
            confirmDeleteProjectMessage:
              "Are you sure you want to delete the Project '<strong>{projectName}</strong>'?",
            alertAddProjectNotImplemented:
              "The 'Add Project' feature is under development.",
            alertEditProjectNotImplemented:
              "The 'Edit Project' feature is under development.",
            modalTitleBackupProject: "Backup Project Data",
            promptSelectProject: "-- Select a project --",
            errorSelectProject: "Please select a project.",
            projectExportSuccess:
              "Successfully exported data for project '{projectName}'.",
            errorProjectNotFound: "Project not found.",
            confirmOverwriteProjectTitle: "Project Exists",
            confirmOverwriteProjectMessage:
              "Project '<strong>{projectName}</strong>' already exists. Do you want to <strong>delete all old data</strong> for this project and replace it with data from the file?",
            btnOverwrite: "Overwrite",
            confirmImportNewProjectTitle: "Confirm New Project Import",
            confirmImportNewProjectMessage:
              "Are you sure you want to add the project '<strong>{projectName}</strong>' and all related data to the application?",
            btnImport: "Import",
            errorInvalidProjectBackupFile:
              "Invalid file or not a project backup file.",
            errorImportingProject:
              "An error occurred while processing the file.",
            projectImportSuccess:
              "Project data has been imported successfully!",
            projectImportFailed:
              "The import process failed. Please check the console.",
            modalTitleOrphanData: "Orphan Data Management",
            orphanDataDescription:
              "Below is a list of records that reference non-existent items (e.g., contracts belonging to a deleted project). You can review and delete individual items or clear all to clean up the system.",
            orphanUnusedProjects: "Unused Projects",
            orphanUnusedProjectsDesc:
              "These are projects with no contracts assigned to them. You can delete them if they are no longer needed.",
            orphanContractsWithOrphanProject:
              "Contracts with Non-Existent Project",
            orphanContractsWithOrphanVendor:
              "Contracts with Non-Existent Vendor",
            orphanCpcWithOrphanContract: "CPCs with Non-Existent Contract",
            orphanInstallmentsWithOrphanCpc:
              "Payments with Non-Existent CPC",
            orphanBondsWithOrphanCpc: "Bonds with Non-Existent CPC",
            orphanProjectLabel:
              "Project: <strong>{name}</strong> (ID: {id})",
            orphanContractLabel:
              "Contract: <strong>{contractNo}</strong> (ID: {id}) - Refers to Project ID: <code>{projectId}</code>",
            orphanContractVendorLabel:
              "Contract: <strong>{contractNo}</strong> (ID: {id}) - Refers to Vendor ID: <code>{vendorId}</code>",
            orphanCpcLabel:
              "CPC: <strong>{cpcIdentifier}</strong> (ID: {id}) - Refers to Contract ID: <code>{contractId}</code>",
            orphanInstallmentLabel:
              "Payment: <strong>{amount}</strong> on <strong>{date}</strong> (ID: {id}) - Refers to CPC ID: <code>{cpcId}</code>",
            orphanBondLabel:
              "Bond: <strong>{bondNumber}</strong> (ID: {id}) - Refers to CPC ID: <code>{cpcId}</code>",
            btnDeleteOrphan: "Delete",
            orphanDataSuccess:
              "Scan complete! No orphan data found in the system.",
            btnDeleteAllOrphans: "Delete All Orphan Data",
            confirmDeleteOrphanTitle: "Confirm Deletion",
            confirmDeleteOrphanMessage:
              "Are you sure you want to permanently delete this item (ID: {itemId})?",
            orphanItemDeleted: "Item (ID: {itemId}) deleted successfully.",
            orphanDeleteFailed:
              "Deletion failed. Please check the console.",
            confirmDeleteAllOrphansTitle: "Confirm Delete All",
            confirmDeleteAllOrphansMessage:
              "This action will permanently delete **ALL** listed items. Are you sure you want to continue?",
            btnYesDeleteAll: "Yes, Delete All",
            allOrphansDeleted:
              "All orphan data has been successfully cleaned up.",
            deleteAllOrphansFailed:
              "Bulk deletion failed. Please check the console.",
            btnColumns: "Columns",
            btnSubColumns: "Sub-Columns",
            row: "Row",
            xmlLoadSuccess: "Invoice data loaded from XML successfully.",
            xmlLoadError: "Error parsing XML file.",
            paymentUpdatedSuccess: "Payment updated successfully.",
            contractDataAutoFilled:
              "Contract data has been auto-filled from the master list.",
            errorNoVendorDataToExport: "No vendor data to export.",
            vendorExportSuccess: "Vendors exported successfully.",
            allProjects: "All Projects",
            contractAmountTotal: "Contract Amount",
            vonTotal: "VON",
            contractVatTotal: "Contract VAT",
            contractGrandTotal: "Total Contract",
            paidAmountExclVAT: "Paid (Excl. VAT)",
            paidVatAmount: "Paid (VAT)",
            paidAmountInclVAT: "Paid (Incl. VAT)",
            invoiceAmountTotal: "Invoice Amount",
            invoiceVatTotal: "Invoice VAT",
            invoiceGrandTotal: "Total Invoice",
            tooltipSendCpc:
              "Click to send/update this CPC. Ctrl+Click to send/update ALL CPCs for this contract.",
            btnResyncData: "Check & Repair Data",
            confirmResyncTitle: "Confirm Data Check & Repair",
            confirmResyncMessage:
              "This action will scan the entire database to find and fix inconsistent information (e.g., incorrect project or vendor names in child items).<br><br>This process is safe and recommended after importing data from a file or if you suspect errors. Do you want to continue?",
            btnStart: "Start",
            confirmBulkSendTitle: "Confirm Bulk Send",
            confirmBulkSendMessage:
              "Are you sure you want to send/update all <strong>{count}</strong> CPC items for contract <strong>{contractNo}</strong>?",
            btnConfirmSendAll: "Yes, Send All",
            errorSelectContractAction:
              "Please select a contract to perform this action.",
            infoNoCpcToSend: "There are no CPCs to send for this contract.",
            successBulkCpcSent:
              "Successfully sent/updated {count} CPC items.",
            errorBulkCpcFailed: "Bulk CPC send failed.",
            promptDebugVendor: "Please enter the Vendor No. to debug:",
            confirmMergeVendorTitle: "Duplicate Vendor No. Detected",
            confirmMergeVendorMessage:
              'Vendor No. <strong>{vendorNo}</strong> already exists for vendor "<strong>{destName}</strong>".<br><br>Do you want to merge the vendor you are editing ("<strong>{sourceName}</strong>") into the existing one? <br><br><strong class="text-danger">Note:</strong> All contracts from "{sourceName}" will be reassigned to "{destName}", and "{sourceName}" will be deleted. This action cannot be undone.',
            btnConfirmMerge: "Yes, Merge",
            errorInvalidMergeIds:
              "Error: Invalid vendor IDs for merge operation.",
            errorMergeVendorNotFound:
              "Error: Could not find vendors in the system.",
            successVendorMerged:
              'Successfully merged vendor "{sourceName}" into "{destName}"!',
            errorVendorMergeFailed:
              "An error occurred during the merge. Data has been rolled back.",
            warningEnterCpcForInvoice:
              "Enter CPC number in the current row before uploading invoice.",
            errorSelectRowForInvoice:
              "Please select at least one row to distribute the invoice.",
            errorVendorConstraint:
              "Error: Vendor Name or No. already exists in the database.",
            errorContractNoExists:
              "Error: Contract number '{contractNo}' already exists.",
          },
          vi: {
            actionCenterTitle: "Trung tâm Xử lý CPC",
            overdueRecently: "Hồ sơ Quá hạn",
            allStable: "Tất cả ổn định",
            showDetails: "XEM CHI TIẾT",
            collapse: "THU GỌN",
            noOverdueRecords: "Không có hồ sơ quá hạn.",
            noPartialRecords: "Không có hồ sơ trả một phần.",
            noUpcomingRecords: "Chưa có hồ sơ sắp đến hạn.",
            daysLate: "trễ {days} ngày",
            daysRemaining: "còn {days} ngày",
            remainingLabel: "Còn lại",
            swapLabel: "Cấn trừ",
            offsetLabel: "Bù trừ",
            vendorpartner: "Đối tác Nhà thầu",
            contractoverview: "Tổng quan Hợp đồng",
            contactPerson: "Người liên hệ",
            phoneNumber: "Số điện thoại",
            vendorPartner: "Đối tác Nhà thầu",
            vendorSearchHint: "Tìm tên, mã số thuế...",
            startSearchPrompt: "Nhập tên hoặc mã NCC để bắt đầu...",
            noResultsFound: "Không tìm thấy kết quả nào khớp.",
            selectVendorPrompt: "Vui lòng chọn một nhà thầu để xem dữ liệu",
            activeContracts: "Hợp đồng hiện hữu",
            joinedProjects: "Dự án tham gia",
            cpcOutstanding: "CÔNG NỢ CPC CHƯA TRẢ",
            advBalance: "DƯ NỢ TẠM ỨNG",
            retentionHeld: "BẢO HÀNH ĐANG GIỮ",
            workProgress: "TIẾN ĐỘ THỰC HIỆN",
            retentionPool: "Quỹ bảo hành",
            unrecovered: "Chưa thu hồi",
            contractProjectHeader: "HỢP ĐỒNG & DỰ ÁN",
            contractValueHeader: "GIÁ TRỊ HĐ",
            confirmedCpc: "CPC ĐÃ XÁC NHẬN",
            acceptanceShort: "NT", // Viết tắt cho Nghiệm thu
            advBalShort: "Dư tạm ứng",
            cpcOutstanding: "CÔNG NỢ CPC CHƯA TRẢ",
            advBalance: "DƯ NỢ TẠM ỨNG",
            retentionHeld: "BẢO HÀNH ĐANG GIỮ",
            performance: "TIẾN ĐỘ THỰC HIỆN",
            vendorPartner: "Đối tác Nhà thầu",
            vendorSearchHint: "Tìm tên, mã số thuế...",
            totalCommitted: "TỔNG HẠN MỨC CAM KẾT",
            performance: "HIỆU SUẤT THỰC HIỆN",
            disbursedNet: "ĐÃ GIẢI NGÂN (NET)",
            retentionHeld: "BẢO HÀNH ĐANG GIỮ",
            contractList: "Danh sách Hợp đồng chi tiết",
            confirmedAmount: "Đã xác nhận / Thực chi",
            activeVendor: "Nhà thầu đang hoạt động",
            retentionPool: "Quỹ bảo hành",
            initialAdvance: "Tạm ứng ban đầu",
            additionalAdvance: "Tạm ứng bổ sung",
            currentAdvanceBalance: "Dư nợ tạm ứng hiện tại",
            processing: "Đang xử lý",
            contractOverview: "Tổng quan Hợp đồng",
            vendorPartner: "Đối tác Nhà thầu",
            mainContract: "HỢP ĐỒNG CHÍNH",
            totalValue: "Tổng giá trị",
            duration: "Thời hạn",
            acceptanceProgress: "TIẾN ĐỘ NGHIỆM THU",
            totalPaidHeader: "ĐÃ THANH TOÁN",
            totalPaidNote: "Tổng tiền đã giải ngân (Gồm VAT)",
            advanceBalanceHeader: "DƯ NỢ TẠM ỨNG",
            retentionValueHeader: "GIÁ TRỊ GIỮ LẠI",
            budget: "Dự toán",
            advanceFlow: "Dòng tiền Tạm ứng",
            totalRecovered: "Đã thu hồi/khấu trừ",
            toRecover: "Cần thu hồi tiếp",
            paymentHistory: "Lịch sử hồ sơ thanh toán",
            cpcStatusGroup: "Hồ sơ / Trạng thái nhóm",
            summaryPaid: "TỔNG CÁC ĐỢT ĐÃ THANH TOÁN XONG",
            summaryProcessing: "TỔNG CÁC ĐỢT ĐANG XỬ LÝ / DỞ DANG",
            backToDetails: "Quay lại Chi tiết CPC",
            viewOverviewMode: "Xem tổng quát (2 dòng)",
            viewDetailedMode: "Xem chi tiết từng đợt",
            bondEffective: "Thông tin Bảo lãnh (Còn hiệu lực)",
            noBonds: "Hợp đồng này hiện không có bảo lãnh nào.",
            agingReportDate: "Tính tuổi nợ đến ngày",
            viewByInvoice: "Theo Hóa đơn",
            viewByContract: "Theo Hợp đồng (CPC)",
            age1_30: "1-30 ngày",
            age31_60: "31-60 ngày",
            age61_90: "61-90 ngày",
            ageOver90: "> 90 ngày",
            totalOverdue: "Tổng nợ quá hạn",
            invoiceNet: "Nợ gốc",
            invoiceVat: "Thuế VAT",
            invoiceTotal: "Tổng cộng",
            contractDateLabel: "Ngày HĐ",
            descriptionLabel: "Mô tả",
            btnExportExcel: "Xuất Excel",
            promptSelectProjectAging:
              "Vui lòng chọn Dự án để xem dữ liệu tuổi nợ",
            noAgingData: "Không có dữ liệu quá hạn tính đến {date}",
            calculatingData: "Đang tính toán lại toàn bộ dữ liệu...",
            refreshSuccess: "Đã làm mới số liệu thành công!",
            phaseRowsInitialized:
              "Đã khởi tạo các dòng trống cho giai đoạn mới.",
            errorUploadInSummaryMode:
              "Bạn đang ở chế độ xem Tổng hợp. Vui lòng chọn Tab Giai đoạn cụ thể để tải lên dữ liệu.",
            phaseAddedSuccess: "Đã thêm giai đoạn mới thành công.",
            phaseRenamedSuccess: "Đổi tên thành công.",
            phaseDeletedSuccess: "Đã xóa giai đoạn và dữ liệu liên quan.",
            phaseDeleteError: "Lỗi hệ thống khi xóa dữ liệu.",
            filteringBondForContract:
              "Đang lọc các bảo lãnh sắp/đã hết hạn của HĐ: {contractNo}",
            vendorNoContractWarning:
              "Nhà cung cấp này chưa có hợp đồng nào trong hệ thống (Chỉ có trong Kế toán).",
            filteringContractForVendor:
              "Đang lọc hợp đồng của: {vendorName}",
            errorDateInvalidField:
              "Ngày '{dateStr}' cho trường '{field}' không hợp lệ. Vui lòng chọn ngày trong khoảng 2010-2040.",
            errorDateInvalidInstallment:
              "Ngày trong các đợt thanh toán không hợp lệ (phải từ 2010-2040).",
            errorPaymentExceedsDetailsNegative:
              "Giá trị cấn trừ ({totalPaid}) không hợp lệ cho khoản phải thu ({cpcAmount}). Vui lòng nhập giá trị dương và không lớn hơn {absAmount}.",
            errorContractNotFound: "Lỗi: Không tìm thấy hợp đồng gốc.",
            rowAddedSuccess: "Đã thêm dòng mới.",
            rowAddError: "Không thể thêm dòng mới.",
            errorNoRowsToUpdateInvoice:
              "Không tìm thấy dòng nào để cập nhật hóa đơn.",
            dataAppendedSuccess: "Đã nối tiếp dữ liệu vào {phaseName}.",
            dataAppendError: "Lỗi khi thêm nối tiếp dữ liệu.",
            dataOverwrittenSuccess: "Đã thay thế dữ liệu cho {phaseName}.",
            noValidDataFound: "Không tìm thấy dữ liệu hợp lệ trong file.",
            resyncStarted: "Bắt đầu quá trình kiểm tra và đồng bộ hóa...",
            resyncComplete:
              "Hoàn tất! Đã kiểm tra và cập nhật {count} bản ghi.",
            resyncError: "Quá trình đồng bộ hóa đã xảy ra lỗi.",
            errorSelectContractToExport:
              "Vui lòng chọn một hợp đồng để xuất.",
            errorNoDetailDataToExport: "Không có dữ liệu chi tiết để xuất.",
            exportDetailsSuccess: "Xuất chi tiết thành công.",
            errorProjectNameRequired: "Vui lòng nhập tên Dự án.",
            errorProjectNameExists: "Tên dự án '{name}' đã tồn tại.",
            projectAddSuccess: "Thêm dự án mới thành công!",
            projectUpdateSuccess: "Cập nhật dự án thành công!",
            projectSaveError: "Lưu dự án thất bại.",
            warningMismatchVatPayment:
              "VAT Đã trả ({paid}) >= VAT Hóa đơn ({invoice}). Dòng bị bỏ qua.",
            historyRecord: "Lịch sử GH",
            settledStatus: "Đã tất toán",
            viewDetails: "Xem chi tiết",
            renewalHistoryTooltip: "Lịch sử gia hạn",
            quickSettleTooltip: "Bật/Tắt trạng thái Quyết toán nhanh",
            bondSettled: "Đã tất toán",
            tabInvoiceAging: "Công nợ Hóa đơn",
            invoiceFilterTitle: "Bộ lọc Hóa đơn",
            ageDays: "Tuổi nợ (Ngày)",
            filterOverdueDays: "Lọc quá hạn trên:",
            daysUnit: "ngày",
            remainingNet: "Còn lại (Net)",
            remainingVat: "Còn lại (VAT)",
            remainingTotal: "Tổng còn lại",
            promptSelectProjectForAging:
              "Vui lòng chọn Dự án để xem công nợ hóa đơn",
            promptSelectProjectForAgingDesc:
              "Chọn 'Hiện bộ lọc' -> 'Dự án' để bắt đầu.",
            noInvoiceAgingData:
              "Không tìm thấy hóa đơn công nợ nào thỏa mãn điều kiện.",
            invoiceNoLabel: "Số Hóa đơn",
            sidebarPin: "Ghim Menu",
            sidebarUnpin: "Tự động thu gọn",
            swapProduct: "Sản phẩm SWAP",
            generalNotes: "Ghi chú chung",
            addNoteTab: "Thêm tab ghi chú mới",
            promptNewTabTitle: "Vui lòng nhập tiêu đề cho tab mới:",
            promptAddNoteTab: "Thêm một tab mới để bắt đầu ghi chú.",
            confirmDeleteTabTitle: "Xóa Tab",
            confirmDeleteTabMessage:
              "Bạn có chắc chắn muốn xóa tab {title} không? Toàn bộ nội dung trong tab này sẽ bị mất.",
            significantNotes: "Điều khoản quan trọng",
            viewEditNotes: "Xem/Sửa",
            significantNotesTitle: "Ghi chú Điều khoản Thanh toán",
            notesPlaceholder:
              "Nhập các điều kiện thanh toán quan trọng của hợp đồng tại đây...",
            noNotesAvailable: "Chưa có ghi chú nào.",
            btnExportVendors: "Xuất NCC",
            btnUploadCategories: "Tải lên Hạng mục",
            categoryUploadSuccess:
              "Đã xử lý thành công {added} hạng mục mới và {updated} hạng mục cập nhật.",
            categoryUploadSkipped:
              "Đã bỏ qua {skipped} dòng do thiếu dữ liệu hoặc có lỗi.",
            errorNoCategoryDataToExport:
              "Không có dữ liệu hạng mục để xuất.",
            categoryExportSuccess: "Xuất danh sách hạng mục thành công!",
            categoryTab: "Hạng mục Báo cáo",
            addCategory: "Thêm Hạng mục",
            categoryTableHeaderNo: "STT",
            categoryTableHeaderCode: "Mã",
            categoryTableHeaderNameVi: "Tên Tiếng Việt",
            categoryTableHeaderNameEn: "Tên Tiếng Anh",
            categoryTableHeaderUsage: "Số HĐ sử dụng",
            categoryTableNoData: "Chưa có hạng mục nào.",
            categoryModalAddTitle: "Thêm Hạng mục Mới",
            categoryModalEditTitle: "Chỉnh sửa Hạng mục",
            categoryParentLabel: "Hạng mục cha (Để trống nếu là cấp 1)",
            categoryParentOption: "-- Là hạng mục cha (Cấp 1) --",
            categoryCodeLabel: "Mã Hạng mục",
            categoryCodeReadonly: "Không thể thay đổi mã sau khi đã tạo.",
            categoryNameViLabel: "Tên Tiếng Việt",
            categoryNameEnLabel: "Tên Tiếng Anh",
            errorCategoryRequired: "Mã và Tên Tiếng Việt là bắt buộc.",
            errorCategoryCodeExists: "Mã hạng mục '{code}' đã tồn tại.",
            categoryAddSuccess: "Thêm hạng mục mới thành công!",
            categoryUpdateSuccess: "Cập nhật hạng mục thành công!",
            categorySaveFailed: "Lưu hạng mục thất bại.",
            errorCategoryInUse:
              "Không thể xóa hạng mục đang được sử dụng bởi một hoặc nhiều hợp đồng.",
            confirmDeleteCategory:
              "Bạn có chắc chắn muốn xóa hạng mục <strong>{code} - {name}</strong> không?",
            warningDeleteParentCategory:
              "<strong class='text-danger'>CẢNH BÁO:</strong> Đây là hạng mục cha. Toàn bộ <strong>{count}</strong> hạng mục con cũng sẽ bị xóa.",
            errorDeleteParentInUse:
              "Không thể xóa hạng mục cha vì một trong các hạng mục con đang được sử dụng.",
            categoryDeleteSuccess: "Đã xóa hạng mục thành công.",
            categoryDeleteFailed: "Xóa hạng mục thất bại.",
            confirmSendCpcTitle: "Xác nhận gửi CPC",
            confirmUpdateCpcMessage:
              "CPC <strong>{cpcNo}</strong> đã tồn tại. Bạn có muốn cập nhật giá trị thành <strong>{amount}</strong> dựa trên tổng các dòng chi tiết không?",
            btnUpdate: "Cập nhật",
            confirmSendCpcMessage:
              "Bạn có chắc chắn muốn gửi CPC <strong>{cpcNo}</strong> với tổng giá trị là <strong>{amount}</strong> không?",
            btnSend: "Gửi",
            editProject: "Sửa Dự án",
            validationErrorTitle: "Lỗi Xác thực Dữ liệu File Excel",
            validationErrorIntro:
              "Không thể nhập file vì đã phát hiện các lỗi sau. Vui lòng sửa chúng trong file Excel của bạn và thử lại:",
            validationSheet: "Sheet",
            validationRow: "Dòng",
            validationMessage: "Nội dung lỗi",
            validationErrorRequired:
              "Trường bắt buộc '<strong>{field}</strong>' bị bỏ trống.",
            validationErrorNoContract:
              "Hợp đồng '<strong>{contractNo}</strong>' không tồn tại trong Dữ liệu Nguồn của hệ thống.",
            validationErrorDuplicate:
              "CPC với số này cho hợp đồng này đã tồn tại (trong CSDL hoặc bị trùng lặp trong file).",
            validationErrorOrphaned:
              "Thanh toán mồ côi: không tìm thấy CPC cha tương ứng hoặc CPC cha không hợp lệ trong sheet 'CPC_Main'.",
            cpcUploadSuccess:
              "Đã thêm thành công {cpcCount} CPC và {instCount} đợt thanh toán.",
            uploadSkipped: "Đã bỏ qua {count} dòng do lỗi.",
            uploadSkippedReasonMissingData:
              "Thiếu thông tin bắt buộc 'contractNo' hoặc 'cpc'.",
            uploadSkippedReasonNoContract:
              "Hợp đồng '{contractNo}' không được tìm thấy trong Dữ liệu Nguồn.",
            uploadSkippedReasonDuplicate:
              "CPC cho hợp đồng này đã tồn tại (trong CSDL hoặc trong file).",
            uploadSkippedReasonOrphaned:
              "Thanh toán mồ côi: không tìm thấy CPC cha hợp lệ trong file.",
            confirmSettleTitle: "Xác nhận Quyết toán",
            confirmCancelSettleTitle: "Xác nhận Hủy Quyết toán",
            confirmSettleMessage:
              "Bạn có chắc chắn muốn quyết toán bảo lãnh <strong>{bondNumber}</strong> không?",
            confirmCancelSettleMessage:
              "Bạn có chắc chắn muốn hủy trạng thái quyết toán của bảo lãnh <strong>{bondNumber}</strong> không?",
            btnConfirmSettle: "Đồng ý Quyết toán",
            btnConfirmCancelSettle: "Đồng ý Hủy",
            bondSettledSuccess:
              "Bảo lãnh '{bondNumber}' đã được quyết toán.",
            bondUnsettledSuccess:
              "Đã hủy quyết toán cho bảo lãnh '{bondNumber}'.",
            errorFindBondToUpdate:
              "Lỗi: Không tìm thấy bảo lãnh để cập nhật.",
            errorUpdateBondStatus:
              "Không thể cập nhật trạng thái bảo lãnh.",
            tooltipBondRenewed: "Đã gia hạn, không thể thay đổi.",
            tooltipBondCancelSettle: "Nhấn để hủy quyết toán.",
            tooltipBondQuickSettle: "Nhấn để quyết toán nhanh.",
            btnUploadBonds: "Tải lên Bảo lãnh",
            btnExportBonds: "Xuất Bảo lãnh",
            errorNoBondDataToExport: "Không có dữ liệu bảo lãnh để xuất.",
            bondExportSuccess: "Xuất dữ liệu bảo lãnh thành công!",
            bondUploadSuccess: "Đã thêm thành công {count} bảo lãnh mới.",
            bondUploadNone: "Không có bảo lãnh nào mới được thêm.",
            bondUploadSkipped: " Đã bỏ qua {count} dòng do lỗi.",
            bondUploadReasonMissingData:
              "Thiếu số Hợp đồng hoặc số Bảo lãnh.",
            bondUploadReasonExists: "Số Bảo lãnh đã tồn tại.",
            bondUploadReasonNoContract:
              "Không tìm thấy Hợp đồng '{contractNo}'.",
            bondUploadSkippedConsole: "Các bảo lãnh bị bỏ qua:",
            excelHeaderContract: "Hợp đồng",
            excelHeaderBondNumber: "Số Bảo lãnh",
            excelHeaderReference: "Tham chiếu",
            excelHeaderBondType: "Loại Bảo lãnh",
            excelHeaderAmount: "Số tiền",
            excelHeaderIssueDate: "Ngày phát hành",
            excelHeaderExpiryDate: "Ngày hết hạn",
            excelHeaderBank: "Ngân hàng",
            excelHeaderStatus: "Trạng thái",
            appTitle: "CPC Vision",
            toggleLanguage: "Đổi ngôn ngữ",
            btnClose: "Đóng",
            btnSaveChanges: "Lưu thay đổi",
            btnCancel: "Hủy",
            confirm: "Xác nhận",
            warning: "Cảnh báo",
            areYouSure: "Bạn có chắc chắn không?",
            actionCannotBeUndone: "Hành động này không thể được hoàn tác.",
            allFiltersCleared: "Tất cả bộ lọc đã được xóa.",
            activeFilters: "Bộ lọc đang áp dụng",
            editFilters: "Sửa Bộ lọc",
            noActiveFilters: "Không có bộ lọc nào được áp dụng.",
            filterPanelTitle: "Bảng điều khiển Bộ lọc",
            search: "Tìm kiếm",
            columns: "Các cột",
            subColumns: "Các cột con",
            total: "Tổng cộng",
            grandTotal: "TỔNG CỘNG",
            footerRemaining: "Số dư còn lại",
            status: "Trạng thái",
            action: "Hành động",
            saveChanges: "Lưu thay đổi",
            saved: "Đã lưu",
            unsaved: "Chưa lưu",
            unsavedChangesTooltip:
              "Bạn có các thay đổi chưa được lưu. Nhấn nút để lưu lại.",
            savedStatusTooltip:
              "Mọi thay đổi đã được lưu vào trình duyệt của bạn.",
            guideTitle: "Hướng dẫn sử dụng",
            print: "In",
            viewAs: "Xem theo",
            configure: "Cấu hình",
            banks: "Ngân hàng",
            ok: "OK",
            na: "Không có",
            calculationRules: "Quy tắc Tính toán",
            repaymentThresholdLabel: "Tỷ lệ tính Khấu trừ Tạm ứng (%)",
            repaymentThresholdNote: "Mặc định: 80%.",
            retentionRateLabel: "Tỷ lệ Giữ lại (%)",
            retentionRateNote: "Mặc định: 5%.",
            defaultVatRateLabel: "Tỷ lệ VAT Mặc định (%)",
            defaultVatRateNote: "Mặc định: 8%.",
            hide: "Ẩn",
            change: "Sửa",
            tabCpcTracking: "Theo dõi CPC",
            cpctracking: "Theo dõi CPC",
            tabCpcDetails: "Chi tiết CPC",
            cpcdetails: "Chi tiết CPC",
            tabVendorBalance: "Cân đối Công nợ",
            vendorbalance: "Cân đối Công nợ NCC",
            tabPaymentDashboard: "Thanh toán",
            cpcdashboard: "Bảng điều khiển Thanh toán",
            tabSwapDashboard: "SWAP",
            cpcswapdashboard: "Bảng điều khiển SWAP",
            tabBondDashboard: "Bảo lãnh",
            cpcbonddashboard: "Bảng điều khiển Bảo lãnh",
            tabContractDashboard: "Hợp đồng",
            cpccontractdashboard: "Bảng điều khiển Hợp đồng",
            tabReportDashboard: "Báo cáo",
            cpcreportdashboard: "Báo cáo Dashboard",
            tabCogsDashboard: "COGS",
            cogsdashboard: "Bảng điều khiển COGS",
            masterdata: "Dữ liệu Nguồn",
            btnAddCpc: "Thêm CPC",
            btnAddContract: "Thêm Hợp đồng",
            btnAddBond: "Thêm Bảo lãnh",
            btnUploadContracts: "Tải lên Hợp đồng",
            btnData: "Dữ liệu",
            btnTemplate: "Tệp Mẫu",
            btnUpload: "Nhập từ Excel",
            btnUploadMerge: "Tải lên & Trộn",
            btnExport: "Xuất ra Excel",
            btnExportJson: "Xuất ra JSON",
            btnSaveToFile: "Sao lưu ra File",
            btnOpenFile: "Phục hồi từ File",
            btnClearAll: "Xóa Tất cả",
            btnClearAllFilters: "Xóa Tất cả Bộ lọc",
            btnEdit: "Sửa",
            btnAdd: "Thêm",
            btnRenew: "Gia hạn",
            btnDelete: "Xoá",
            btnPrevious: "Trang trước",
            btnNext: "Trang sau",
            btnDownloadDetailsTemplate: "Mẫu Chi tiết",
            btnUploadDetails: "Tải lên Chi tiết",
            btnExportDetails: "Xuất Chi tiết",
            btnBackupProject: "Sao lưu Dự án",
            btnImportProject: "Nhập Dự án",
            btnBackup: "Sao lưu",
            btnRestore: "Phục hồi",
            btnUploadReconcile: "Tải lên & Đối chiếu",
            btnClear: "Xóa",
            btnDebugVendor: "Debug NCC theo Mã",
            btnUploadCogs: "Tải lên & Đối chiếu COGS",
            btnClearCogs: "Xóa Đối chiếu",
            btnAddVendor: "Thêm NCC",
            btnDownloadTemplate: "Tải Template",
            btnCleanupData: "Dọn dẹp Dữ liệu",
            btnAddProject: "Thêm Dự án",
            btnAddBank: "Thêm Ngân hàng",
            btnClearVisibleContracts: "Xóa Hợp đồng Hiển thị",
            btnClearVisibleBonds: "Xóa các Bảo lãnh đang hiển thị",
            showEntriesLabel: "Hiển thị:",
            entriesUnit: "mục",
            searchPlaceholder: "Tìm kiếm...",
            clearSearchTooltip: "Xóa tìm kiếm",
            tableHeaderNo: "STT",
            tableHeaderAction: "Hành động",
            noMatchingData:
              "Không có dữ liệu nào khớp với bộ lọc hiện tại.",
            paginationInfo:
              "Hiển thị từ {start} đến {end} trong tổng số {total} mục",
            paginationPageInfo: "Trang {currentPage} / {totalPages}",
            project: "Dự án",
            vendor: "Nhà cung cấp",
            code: "Mã",
            glaccount: "Tài khoản G/L",
            contract: "Hợp đồng",
            date: "Ngày",
            postingDate: "Ngày hạch toán",
            currency: "Loại tiền tệ",
            bondType: "Loại bảo lãnh",
            dateRange: "Khoảng thời gian",
            startDate: "Ngày bắt đầu",
            endDate: "Ngày kết thúc",
            searchProjects: "Tìm dự án...",
            searchVendors: "Tìm nhà cung cấp...",
            searchCodes: "Tìm mã...",
            searchContracts: "Tìm hợp đồng...",
            searchTypes: "Tìm loại...",
            searchPaymentSources: "Tìm nguồn thanh toán...",
            tooltipClearFilter: "Xóa bộ lọc",
            tooltipResetDate: "Đặt lại khoảng ngày",
            cpc: "CPC",
            contents: "Nội dung",
            department: "Bộ phận",
            contractSystemNo: "Số HĐ trên hệ thống",
            vendorNo: "Mã nhà cung cấp",
            amountInclVAT: "Số tiền (gồm VAT)",
            receivedDate: "Ngày nhận",
            paymentDueDate: "Hạn thanh toán",
            amountPaid: "Số tiền đã trả",
            paymentDate: "Ngày thanh toán",
            lineTracking: "Theo dõi trình ký",
            notes: "Ghi chú",
            installment: "Đợt thanh toán",
            bond: "Bảo lãnh",
            moreInfo: "Thêm",
            installment_ordinal: "Đợt {num}{ordinal}",
            installment_swap: "Đợt {num}{ordinal}",
            noPaymentsAvailable: "Không có dữ liệu thanh toán.",
            tooltipEdit: "Sửa",
            tooltipCopy: "Sao chép",
            tooltipDelete: "Xóa",
            complete: "Hoàn thành",
            partialpayment: "TT một phần",
            pending: "Chờ xử lý",
            completeswap: "Hoàn thành SWAP",
            partialswap: "SWAP một phần",
            completeswappayment: "Hoàn thành TT SWAP",
            partialswappayment: "TT SWAP một phần",
            status_overdue_days: "Quá hạn {days} ngày",
            status_due_today: "Đến hạn hôm nay",
            status_days_left: "Còn {days} ngày",
            completeWithOffset: "Hoàn thành (Cấn trừ)",
            swap: "SWAP",
            swapPayments: "Các đợt thanh toán SWAP",
            addSwapPayment: "Thêm đợt thanh toán SWAP",
            swapPaidLabel: "Đã thanh toán SWAP",
            vendorSWAP: "Nhà cung cấp SWAP",
            swapAgreement: "Thỏa thuận SWAP",
            agreementDate: "Ngày Thỏa thuận",
            swapInformation: "Thông tin SWAP",
            swapDueDatePayment: "Hạn thanh toán SWAP",
            swapAmountPaid: "Đã trả SWAP",
            paidStatus: "Đã trả",
            unpaidStatus: "Chưa trả",
            collected: "Đã thu hồi",
            partiallyCollected: "Thu hồi một phần",
            uncollected: "Chưa thu hồi",
            swapPaymentDate: "Ngày thanh toán SWAP",
            duebond: "Bảo lãnh đến hạn/hết hạn",
            bondNumber: "Số bảo lãnh",
            ref: "Tham chiếu",
            issueDate: "Ngày phát hành",
            expiryDate: "Ngày hết hạn",
            issuingBank: "Ngân hàng phát hành",
            quickSettle: "Quyết toán nhanh",
            bond_status_overdue: "Quá hạn {days} ngày",
            bond_status_expiring: "Hết hạn trong {days} ngày",
            bond_status_active: "Hiệu lực",
            renewedStatus: "Đã gia hạn",
            noExpenseData: "Không có dữ liệu chi phí nào khớp với bộ lọc.",
            noBondData: "Không có dữ liệu bảo lãnh nào khớp với bộ lọc.",
            noSwapData: "Không có dữ liệu SWAP nào khớp với bộ lọc.",
            gl3311: "Phải trả NCC",
            gl3312: "Tạm ứng NCC",
            outstandingBalanceStatus: "Trạng thái Công nợ",
            balanceStatusHasBalance: "Phải trả/Tạm ứng ≠ 0",
            fullySettled: "Phải trả & Tạm ứng = 0",
            reportAsOf: "Báo cáo tính đến",
            reportAsOfNote: "Để trống để xem số dư hiện tại.",
            payableSap: "Phải trả (SAP)",
            advanceSap: "Tạm ứng (SAP)",
            difference: "Chênh lệch",
            statusMatch: "Khớp",
            statusMismatch: "Lệch",
            statusOnlyinApp: "Chỉ có trên App",
            statusOnlyinAccounting: "Chỉ có trên SAP",
            cogsSummaryTitle: "Tổng hợp theo Tài khoản Kế toán",
            cogsDetailTitle: "Chi tiết Hợp đồng để Đối chiếu",
            invAmountApp: "Giá trị HĐ (App)",
            invAmountSap: "Giá trị HĐ (SAP)",
            reconciliationStatus: "Trạng thái",
            transactionType: "Loại Giao dịch",
            transactionTypeReceivable: "Thu hồi Công nợ",
            transactionTypePayable: "Thanh toán Phải trả",
            modalTitleEdit: "Sửa Mục CPC",
            modalTitleCopy: "Sao chép Mục CPC",
            modalTitleAdd: "Thêm Mục CPC Mới",
            modalTitleEditFinancials: "Sửa Tài chính & Thanh toán",
            modalTitleAddContract: "Thêm Hợp đồng Mới",
            modalTitleEditContract: "Sửa Hợp đồng",
            modalTitleAddVendor: "Thêm NCC Mới",
            editVendor: "Sửa NCC",
            modalTitleEditInstallment: "Sửa Thanh toán",
            modalTitleEditContractDetail: "Sửa Chi tiết Hợp đồng",
            modalTitleEditCpcDetail: "Sửa Chi tiết CPC",
            modalTitleEditPaymentDetail: "Sửa Chi tiết Thanh toán",
            modalTitleEditInvoiceDetail: "Sửa Chi tiết Hóa đơn",
            editSwapTitle: "Chỉnh sửa Chi tiết SWAP",
            modalSectionMain: "Thông tin chính",
            modalSectionFinancial: "Tài chính & Ngày tháng",
            modalSectionSystem: "Thông tin hệ thống",
            amountExclVAT: "Số tiền (chưa VAT)",
            vatAmount: "VAT",
            amountUSD: "Số tiền USD",
            exchangeRate: "Tỷ giá",
            invoiceExchangeRate: "Tỷ giá Hóa đơn",
            paymentInUSD: "Thanh toán bằng USD",
            paymentInstallments: "Các đợt thanh toán",
            paymentSource: "Nguồn thanh toán",
            addInstallment: "Thêm đợt",
            bondInformation: "Thông tin bảo lãnh",
            selectBondType: "Chọn loại bảo lãnh",
            prepaymentBond: "Bảo lãnh tạm ứng",
            performanceBond: "Bảo lãnh thực hiện HĐ",
            warrantyBond: "Bảo lãnh bảo hành",
            addBond: "Thêm bảo lãnh",
            bondDetailsFor: "Chi tiết bảo lãnh cho",
            noBondInfo: "Không có thông tin bảo lãnh cho mục này.",
            updateBondStatus: "Cập nhật trạng thái bảo lãnh",
            statusUpdate: "Cập nhật trạng thái",
            advancePaymentsCleared: "Khoản tạm ứng đã được khấu trừ hết",
            contractSettled: "Hợp đồng đã được quyết toán",
            otherReason: "Lý do khác",
            inputCustomReason: "Nhập lý do tùy chỉnh",
            renewBond: "Gia hạn bảo lãnh",
            originalBondNumber: "Số bảo lãnh gốc",
            originalBondType: "Loại bảo lãnh gốc",
            originalExpiryDate: "Ngày hết hạn gốc",
            originalAmount: "Số tiền gốc",
            newRenewalDetails: "Chi tiết gia hạn mới",
            newBondNumber: "Số bảo lãnh mới",
            newBondType: "Loại bảo lãnh mới",
            newAmount: "Số tiền mới",
            newIssueDate: "Ngày phát hành mới",
            newExpiryDate: "Ngày hết hạn mới",
            newIssuingBank: "Ngân hàng phát hành mới",
            renewalNotes: "Ghi chú gia hạn",
            btnSaveRenewal: "Lưu Gia hạn",
            updateContractStatus: "Cập nhật Trạng thái Hợp đồng",
            active: "Hoạt động",
            closed: "Đã đóng",
            statusNote: "Ghi chú Trạng thái",
            selectContract: "Chọn Hợp đồng",
            promptSelectContract:
              "Vui lòng chọn một dự án và một nhà cung cấp",
            pleaseSelectContractToView:
              "Vui lòng chọn một hợp đồng để xem hoặc nhập dữ liệu.",
            loadFromXml: "Tải từ XML",
            addNewRow: "Thêm Dòng mới",
            deleteRow: "Xóa Dòng",
            deleteContents: "Xóa Nội dung",
            contractinfo: "Thông tin HĐ",
            details: "Mô tả",
            amount: "Số tiền",
            net: "Net",
            vat: "VAT",
            repaymentBasisTitle:
              "Chọn các giá trị Hợp đồng/VON để tính toán khấu trừ",
            noBasisAvailable:
              "Không có giá trị Hợp đồng/VON nào ở các dòng trước hoặc dòng hiện tại.",
            calcRepayOnWorkdone: "Tính Repayment trên Work-done",
            finalSettlement: "Quyết toán",
            distributeToCpcRows: "Phân bổ cho các dòng CPC:",
            columnGroupContract: "Hợp đồng",
            columnGroupCpc: "CPC",
            columnGroupPayment: "Thanh toán",
            columnGroupInvoice: "Hóa đơn",
            columnGroupRemainingPayable: "Còn lại phải trả",
            columnGroupContractRemaining: "HĐ còn lại",
            reportAsOfDate: "Tính đến ngày",
            reportMonth: "Báo cáo cho tháng",
            category: "HẠNG MỤC",
            reportPaidToDateHeader: "Số đã thanh toán đến ngày {date}",
            reportRemainingFromDateHeader:
              "Số còn phải thanh toán kể từ ngày {date}",
            reportPaidInMonthHeader: "Số thanh toán trong tháng {month}",
            vendor_tab: "Nhà cung cấp",
            project_tab: "Dự án",
            banks_tab: "Ngân hàng",
            abbreviation: "Tên viết tắt",
            contractCount: "Số Hợp đồng",
            searchVendorPlaceholder: "Tìm Nhà cung cấp...",
            noVendorsFound: "Không tìm thấy nhà cung cấp nào.",
            searchProjectPlaceholder: "Tìm Dự án...",
            projectContractCount: "Số HĐ liên quan",
            noProjectsFound: "Không tìm thấy dự án nào.",
            searchBankPlaceholder: "Tìm Ngân hàng...",
            bankContractCount: "Số BL đã phát hành",
            noBanksFound: "Không tìm thấy ngân hàng nào.",
            commandPalettePlaceholder: "Tìm Hợp đồng, CPC, Nhà cung cấp...",
            commandPaletteNoResults: "Không tìm thấy kết quả.",
            cpc_search: "CPC",
            contract_search: "HỢP ĐỒNG",
            notificationHeader: "Thông báo Bảo lãnh",
            noNotifications:
              "Không có bảo lãnh nào sắp hết hạn hoặc đã quá hạn.",
            changesSavedSuccess: "Đã lưu các thay đổi thành công.",
            errorPaymentDate:
              "Ngày thanh toán là bắt buộc đối với các đợt có số tiền lớn hơn không.",
            errorPostingDateRequired:
              "Ngày hạch toán là bắt buộc để lưu hóa đơn.",
            errorPaymentExceedsDetails:
              "Tổng số tiền thanh toán ({totalPaid}) vượt quá số tiền CPC ({cpcAmount}) là {overExcessAmount}.",
            contractCreatedAutomatically:
              "Một hợp đồng mới đã được tự động tạo trong danh sách chính.",
            confirmDeletion: "Xác nhận Xóa",
            confirmDeleteCpcItem:
              "Bạn có chắc chắn muốn xóa mục CPC <strong>{cpc}</strong> không? Hành động này không thể hoàn tác.",
            confirmDeleteRow:
              "Bạn có chắc chắn muốn xóa toàn bộ dòng này không?",
            itemDeleted: "Đã xóa mục thành công.",
            rowDeleted: "Đã xóa dòng thành công.",
            confirmClearAllData:
              "Điều này sẽ xóa vĩnh viễn tất cả dữ liệu CPC và Hợp đồng. Bạn có chắc chắn muốn tiếp tục không?",
            yesClearAll: "Vâng, Xóa Tất cả",
            allDataCleared: "Tất cả dữ liệu của ứng dụng đã được xóa.",
            fileSaveSuccess: "Đã lưu tệp dữ liệu thành công.",
            confirmDataLoad: "Xác nhận Tải Dữ liệu",
            confirmOverwriteData:
              "Điều này sẽ ghi đè tất cả dữ liệu chưa được lưu hiện tại bằng nội dung từ tệp. Bạn có chắc không?",
            loadSuccess: "Dữ liệu đã được tải thành công.",
            invalidJsonFormat: "Định dạng tệp JSON không hợp lệ.",
            errorParsingJson: "Lỗi khi xử lý tệp JSON.",
            errorInvalidExcelFile:
              "Loại tệp không hợp lệ. Vui lòng tải lên tệp .xlsx hoặc .xls.",
            itemsUploaded: "Đã tải lên thành công {count} mục.",
            noValidItems:
              "Không tìm thấy mục hợp lệ mới nào trong tệp để tải lên.",
            errorProcessingExcel: "Đã xảy ra lỗi khi xử lý tệp Excel.",
            errorContractNumberRequired:
              "Số hợp đồng là một trường bắt buộc.",
            errorContractExists:
              "Một hợp đồng với số này đã tồn tại trong danh sách chính.",
            contractSavedSuccess: "Đã lưu hợp đồng thành công.",
            confirmDeleteContract:
              "Bạn có chắc chắn muốn xóa hợp đồng <strong>{contractNo}</strong> khỏi danh sách chính không? Hành động này không thể hoàn tác.",
            contractDeletedSuccess: "Hợp đồng đã được xóa thành công.",
            errorUpdatingPayment:
              "Lỗi: Không thể tìm thấy thanh toán gốc để cập nhật.",
            confirmDeleteBond:
              "Bạn có chắc chắn muốn xóa bảo lãnh <strong>{bondNumber}</strong> không?",
            bondDeletedSuccess: "Bảo lãnh đã được xóa thành công.",
            errorFindBondToDelete:
              "Lỗi: Không thể tìm thấy bảo lãnh cụ thể để xóa.",
            errorFindOriginalCpcItem:
              "Lỗi: Không thể tìm thấy mục CPC gốc cho hoạt động này.",
            errorNewBondDates:
              "Ngày phát hành mới và ngày hết hạn mới là bắt buộc để gia hạn bảo lãnh.",
            bondRenewedSuccess:
              "Bảo lãnh đã được gia hạn thành công và một mục bảo lãnh mới đã được thêm vào.",
            bondInfoSaved: "Thông tin bảo lãnh đã được lưu.",
            cpcSentToTracking: "CPC đã được gửi sang tab Theo dõi.",
            cpcUpdatedInTracking: "CPC đã được cập nhật ở tab Theo dõi.",
            cpcPaymentUpdatedInDetails:
              "Thông tin thanh toán đã được cập nhật vào tab Chi tiết CPC.",
            errorNoDataToSend:
              "Không có dữ liệu CPC trên dòng này để gửi đi.",
            paymentManagedInTracking:
              "Chi tiết thanh toán được quản lý ở tab Theo dõi CPC.",
            detailsDataUploaded:
              "Dữ liệu chi tiết cho hợp đồng {contractNo} đã được cập nhật thành công.",
            confirmOverwriteDetails:
              "Thao tác này sẽ thay thế tất cả chi tiết hiện có của hợp đồng <strong>{contractNo}</strong> bằng dữ liệu từ tệp. Bạn có chắc không?",
            contractStatusUpdated:
              "Cập nhật trạng thái hợp đồng thành công.",
            confirmClearVisibleBonds:
              "Bạn có chắc chắn muốn xóa <strong>{count}</strong> bảo lãnh đang hiển thị không? Hành động này không thể hoàn tác.",
            confirmClearVisibleContracts:
              "Bạn có chắc chắn muốn xóa <strong>{count}</strong> hợp đồng đang hiển thị không? Hành động này không thể hoàn tác.",
            visibleBondsCleared: "{count} bảo lãnh đã được xóa.",
            visibleContractsCleared: "{count} hợp đồng đã được xóa.",
            cogsReconciliationCleared:
              "Dữ liệu đối chiếu COGS đã được xóa.",
            cogsUploadSuccess:
              "Tải lên thành công! Đã xử lý {count} dòng dữ liệu.",
            accountingReconciliationCleared:
              "Dữ liệu đối chiếu đã được xóa.",
            accountingUploadSuccess:
              "Tải lên thành công! Đã xử lý {count} mã Nhà cung cấp từ file.",
            projectDeletedSuccess: "Dự án đã được xóa thành công.",
            projectDeleteFailed: "Xóa dự án thất bại.",
            vendorDeletedSuccess: "Nhà cung cấp đã được xóa thành công.",
            vendorDeleteFailed: "Xóa nhà cung cấp thất bại.",
            errorProjectVendorRequired:
              "Vui lòng nhập đầy đủ thông tin Dự án và Nhà cung cấp.",
            errorSavingCpc: "Lưu dữ liệu CPC thất bại.",
            vendorSavedSuccess:
              "Thông tin nhà cung cấp đã được lưu thành công!",
            vendorSaveFailed: "Lưu thông tin nhà cung cấp thất bại.",
            errorVendorNameRequired: "Vui lòng nhập tên Nhà cung cấp.",
            errorVendorNoRequired: "Vui lòng nhập Mã Nhà cung cấp.",
            errorVendorNameExists:
              "Nhà cung cấp '{vendorName}' đã tồn tại.",
            errorVendorNoExists: "Mã nhà cung cấp '{vendorNo}' đã tồn tại.",
            errorLoadingFromDb:
              "Không thể tải dữ liệu từ cơ sở dữ liệu của trình duyệt.",
            errorSavingChanges: "Lưu thay đổi thất bại.",
            errorSheetNotFound:
              "Không tìm thấy sheet '{sheetName}' trong file Excel.",
            errorNoValidDataInExcel:
              "Không tìm thấy dữ liệu hợp lệ trong file Excel.",
            errorVendorInUse:
              "Không thể xóa nhà cung cấp đang được sử dụng trong hợp đồng.",
            errorProjectInUse:
              "Không thể xóa dự án đang được sử dụng trong hợp đồng.",
            confirmDeleteVendorMessage:
              "Bạn có chắc chắn muốn xóa Nhà cung cấp '<strong>{vendorName}</strong>' không? Hành động này không thể hoàn tác.",
            confirmDeleteProjectMessage:
              "Bạn có chắc chắn muốn xóa Dự án '<strong>{projectName}</strong>' không?",
            alertAddProjectNotImplemented:
              "Chức năng 'Thêm Dự án' sẽ được phát triển.",
            alertEditProjectNotImplemented:
              "Chức năng 'Sửa Dự án' sẽ được phát triển.",
            modalTitleBackupProject: "Sao lưu Dữ liệu Dự án",
            promptSelectProject: "-- Chọn một dự án --",
            errorSelectProject: "Vui lòng chọn một dự án.",
            projectExportSuccess:
              "Đã xuất dữ liệu cho dự án '{projectName}' thành công.",
            errorProjectNotFound: "Không tìm thấy dự án.",
            confirmOverwriteProjectTitle: "Dự án đã Tồn tại",
            confirmOverwriteProjectMessage:
              "Dự án '<strong>{projectName}</strong>' đã có trong dữ liệu hiện tại. Bạn có muốn <strong>xóa toàn bộ dữ liệu cũ</strong> của dự án này và thay thế bằng dữ liệu từ file không?",
            btnOverwrite: "Ghi đè",
            confirmImportNewProjectTitle: "Xác nhận Nhập Dự án Mới",
            confirmImportNewProjectMessage:
              "Bạn có chắc chắn muốn thêm dự án '<strong>{projectName}</strong>' và tất cả dữ liệu liên quan vào ứng dụng không?",
            btnImport: "Nhập",
            errorInvalidProjectBackupFile:
              "File không hợp lệ hoặc không phải là file backup dự án.",
            errorImportingProject: "Có lỗi xảy ra khi xử lý file.",
            projectImportSuccess: "Dữ liệu dự án đã được nhập thành công!",
            projectImportFailed:
              "Quá trình nhập thất bại. Vui lòng kiểm tra console.",
            modalTitleOrphanData: "Quản lý Dữ liệu Mồ côi",
            orphanDataDescription:
              "Dưới đây là danh sách các bản ghi tham chiếu đến các mục không còn tồn tại (ví dụ: hợp đồng thuộc về một dự án đã bị xóa). Bạn có thể xem lại và xóa từng mục hoặc xóa tất cả để dọn dẹp hệ thống.",
            orphanUnusedProjects: "Dự án không được sử dụng",
            orphanUnusedProjectsDesc:
              "Đây là các dự án không có hợp đồng nào được gán vào. Bạn có thể xóa chúng nếu không còn cần thiết.",
            orphanContractsWithOrphanProject:
              "Hợp đồng có Dự án không tồn tại",
            orphanContractsWithOrphanVendor:
              "Hợp đồng có Nhà cung cấp không tồn tại",
            orphanCpcWithOrphanContract: "CPC có Hợp đồng không tồn tại",
            orphanInstallmentsWithOrphanCpc:
              "Thanh toán có CPC không tồn tại",
            orphanBondsWithOrphanCpc: "Bảo lãnh có CPC không tồn tại",
            orphanProjectLabel: "Dự án: <strong>{name}</strong> (ID: {id})",
            orphanContractLabel:
              "HĐ: <strong>{contractNo}</strong> (ID: {id}) - Tham chiếu đến Project ID: <code>{projectId}</code>",
            orphanContractVendorLabel:
              "HĐ: <strong>{contractNo}</strong> (ID: {id}) - Tham chiếu đến Vendor ID: <code>{vendorId}</code>",
            orphanCpcLabel:
              "CPC: <strong>{cpcIdentifier}</strong> (ID: {id}) - Tham chiếu đến Contract ID: <code>{contractId}</code>",
            orphanInstallmentLabel:
              "Thanh toán: <strong>{amount}</strong> ngày <strong>{date}</strong> (ID: {id}) - Tham chiếu đến CPC ID: <code>{cpcId}</code>",
            orphanBondLabel:
              "Bảo lãnh: <strong>{bondNumber}</strong> (ID: {id}) - Tham chiếu đến CPC ID: <code>{cpcId}</code>",
            btnDeleteOrphan: "Xóa",
            orphanDataSuccess:
              "Kiểm tra hoàn tất! Không tìm thấy dữ liệu mồ côi nào trong hệ thống.",
            btnDeleteAllOrphans: "Xóa tất cả Dữ liệu Mồ côi",
            confirmDeleteOrphanTitle: "Xác nhận Xóa",
            confirmDeleteOrphanMessage:
              "Bạn có chắc chắn muốn xóa vĩnh viễn mục này (ID: {itemId}) không?",
            orphanItemDeleted: "Đã xóa mục (ID: {itemId}) thành công.",
            orphanDeleteFailed: "Xóa thất bại. Vui lòng kiểm tra console.",
            confirmDeleteAllOrphansTitle: "Xác nhận Xóa Tất cả",
            confirmDeleteAllOrphansMessage:
              "Hành động này sẽ xóa vĩnh viễn **TẤT CẢ** các mục được liệt kê. Bạn có chắc chắn muốn tiếp tục không?",
            btnYesDeleteAll: "Vâng, Xóa Tất cả",
            allOrphansDeleted:
              "Đã dọn dẹp tất cả dữ liệu mồ côi thành công.",
            deleteAllOrphansFailed:
              "Xóa hàng loạt thất bại. Vui lòng kiểm tra console.",
            btnColumns: "Các cột",
            btnSubColumns: "Các cột con",
            row: "Dòng",
            xmlLoadSuccess:
              "Đã tải dữ liệu hóa đơn từ file XML thành công.",
            xmlLoadError: "Lỗi xử lý file XML.",
            paymentUpdatedSuccess: "Cập nhật thanh toán thành công.",
            contractDataAutoFilled:
              "Dữ liệu hợp đồng đã được tự động điền từ danh sách chính.",
            errorNoVendorDataToExport:
              "Không có dữ liệu nhà cung cấp để xuất.",
            vendorExportSuccess: "Xuất danh sách nhà cung cấp thành công.",
            allProjects: "Tất cả Dự án",
            contractAmountTotal: "Tổng GT Hợp đồng",
            vonTotal: "Tổng GT Von",
            contractVatTotal: "Tổng VAT Hợp đồng",
            contractGrandTotal: "Tổng GT sau VAT",
            paidAmountExclVAT: "Đã trả (chưa VAT)",
            paidVatAmount: "Đã trả (VAT)",
            paidAmountInclVAT: "Đã trả (gồm VAT)",
            invoiceAmountTotal: "Tổng GT Hóa đơn",
            invoiceVatTotal: "Tổng VAT Hóa đơn",
            invoiceGrandTotal: "Tổng GT Hóa đơn (sau VAT)",
            tooltipSendCpc:
              "Click để gửi/cập nhật CPC này. Ctrl+Click để gửi/cập nhật TẤT CẢ CPC cho hợp đồng này.",
            btnResyncData: "Kiểm tra & Sửa chữa Dữ liệu",
            confirmResyncTitle: "Xác nhận Kiểm tra & Sửa chữa Dữ liệu",
            confirmResyncMessage:
              "Hành động này sẽ quét toàn bộ cơ sở dữ liệu để tìm và sửa các thông tin không nhất quán (ví dụ: tên dự án, nhà cung cấp bị sai lệch trong các mục con).<br><br>Quá trình này an toàn và được khuyến khích thực hiện sau khi nhập dữ liệu từ file hoặc khi bạn nghi ngờ có lỗi. Bạn có muốn tiếp tục?",
            btnStart: "Bắt đầu",
            confirmBulkSendTitle: "Xác nhận gửi hàng loạt",
            confirmBulkSendMessage:
              "Bạn có chắc chắn muốn gửi/cập nhật tất cả <strong>{count}</strong> mục CPC cho hợp đồng <strong>{contractNo}</strong> không?",
            btnConfirmSendAll: "Đồng ý Gửi tất cả",
            errorSelectContractAction:
              "Vui lòng chọn một hợp đồng để thực hiện.",
            infoNoCpcToSend: "Không có CPC nào để gửi cho hợp đồng này.",
            successBulkCpcSent:
              "Đã gửi/cập nhật thành công {count} mục CPC.",
            errorBulkCpcFailed: "Gửi hàng loạt CPC thất bại.",
            promptDebugVendor:
              "Vui lòng nhập Mã Nhà cung cấp (Vendor No.) cần debug:",
            confirmMergeVendorTitle: "Phát hiện Trùng Mã Nhà Cung Cấp",
            confirmMergeVendorMessage:
              'Mã nhà cung cấp <strong>{vendorNo}</strong> đã tồn tại cho NCC "<strong>{destName}</strong>".<br><br>Bạn có muốn hợp nhất NCC bạn đang sửa ("<strong>{sourceName}</strong>") vào NCC đã có không? <br><br><strong class="text-danger">Lưu ý:</strong> Toàn bộ hợp đồng của NCC "{sourceName}" sẽ được chuyển sang cho "{destName}" và NCC "{sourceName}" sẽ bị xóa. Hành động này không thể hoàn tác.',
            btnConfirmMerge: "Đồng ý Hợp nhất",
            errorInvalidMergeIds:
              "Lỗi: ID nhà cung cấp không hợp lệ để hợp nhất.",
            errorMergeVendorNotFound:
              "Lỗi: Không tìm thấy nhà cung cấp trong hệ thống.",
            successVendorMerged:
              'Đã hợp nhất thành công NCC "{sourceName}" vào "{destName}"!',
            errorVendorMergeFailed:
              "Đã xảy ra lỗi trong quá trình hợp nhất. Dữ liệu đã được hoàn tác.",
            warningEnterCpcForInvoice:
              "Vui lòng nhập số CPC vào dòng hiện tại trước khi tải lên hóa đơn.",
            errorSelectRowForInvoice:
              "Vui lòng chọn ít nhất một dòng để phân bổ hóa đơn.",
            errorVendorConstraint:
              "Lỗi: Tên hoặc Mã NCC đã tồn tại trong cơ sở dữ liệu.",
            errorContractNoExists:
              "Lỗi: Số hợp đồng '{contractNo}' đã tồn tại.",
          },
        },
        columnVisibility: {},
        dashboardPaymentColumnVisibility: {},
        swapDashboardColumnVisibility: {},
        dashboardBondColumnVisibility: {},
        contractDashboardColumnVisibility: {},
        currentRenewBond: null,
        newBondDetails: {
          bondNumber: "",
          ref: "",
          bondType: "",
          amount: 0,
          displayAmount: "",
          issueDate: "",
          expiryDate: "",
          issuingBank: "",
          isSettled: false,
          settlementReasonDisplay: "",
          renewedFromBondId: null,
          renewalNotes: "",
          renewalDate: "",
        },
        showRepaymentBasisConfig: false,
        currentDetailItem: null,
        currentDetailIndex: -1,
        isModalInitializing: false,
        calculationEngine: null,
        isVatOverrideVisible: false,
        isContractVatOverrideVisible: false,
        invoiceSelectedRowIds: [],
      };
    },

    async created() {
      this.authContext = window.__X3_AUTH_CONTEXT__ || this.authContext;
      this.currentUserProfile = this.authContext?.profile || null;
      this.currentUserRoles = this.authContext?.roles || [];
      this.currentUserPermissions = this.authContext?.permissions || [];
      this.initializeAdminAccessState();
      if (!this.isAdminUser && this.currentTab === "admin-access") {
        this.currentTab = "cpc-tracking";
      }

      // 1. Khởi tạo danh sách hành động cho Command Palette (Ctrl + I)
      this.commandActions = [
        {
          id: "action_add_cpc",
          type: "ACTION",
          searchLabel: this.t("btnAddCpc"),
          searchSublabel: "Tạo một CPC mới trong bảng theo dõi",
          action: () => this.addNewCpcItem(),
        },
        {
          id: "action_add_contract",
          type: "ACTION",
          searchLabel: this.t("btnAddContract"),
          searchSublabel: "Tạo một Hợp đồng mới trong Master Data",
          action: () => this.addNewContractItem(),
        },
        {
          id: "action_add_vendor",
          type: "ACTION",
          searchLabel: this.t("btnAddVendor"),
          searchSublabel: "Tạo một Nhà cung cấp mới trong Master Data",
          action: () => this.openVendorModal("add"),
        },
        {
          id: "action_add_bond",
          type: "ACTION",
          searchLabel: this.t("btnAddBond"),
          searchSublabel: "Thêm mới một Bảo lãnh cho hợp đồng",
          action: () => this.openBondModal("add"),
        },
        {
          id: "action_backup",
          type: "ACTION",
          searchLabel: this.t("btnBackup"),
          searchSublabel: "Sao lưu toàn bộ dữ liệu ra file JSON",
          action: () => this.backupDataToFile(),
        },
      ];

      // 2. Thiết lập mặc định cho ngày chốt số liệu Vendor Balance (Cuối tháng hiện tại)
      const today = new Date();
      this.viewStates.vendorBalance.filter.asOfDate = appUtils.format.date(
        new Date(today.getFullYear(), today.getMonth() + 1, 0)
      );

      // 3. Khởi tạo Engine tính toán và Tìm kiếm
      this.initializeCalculationEngine();
      this.debouncedSearch = this.debounce(this.performSearch, 200);

      try {
        // 4. Kiểm tra và thực hiện nâng cấp cấu trúc Database (nếu có)
        const didMigrate = await this.runDataMigrationToNumericIDs();
        if (didMigrate) {
          console.log("Dữ liệu đã được chuyển đổi. Đang tải lại ứng dụng...");
          alert("Cơ sở dữ liệu đã được cập nhật phiên bản mới. Trang sẽ tự động tải lại.");
          window.location.reload();
          return;
        }

        // 5. Khởi tạo dữ liệu Hạng mục báo cáo (Categories)
        await this.seedInitialCategories();
        this.reportCategoriesFromDB = await getAllCategories(databaseService);

        // 6. Khởi động đồng bộ realtime với Supabase (nếu được bật)
        const syncStatus = await databaseService.startSupabaseSync(
          async () => {
            const freshData = await databaseService.getAllData();
            this._loadState(freshData);
            this.initializeFuse();
          },
          (statusPayload) => this.handleSupabaseSyncStatus(statusPayload)
        );
        this.supabaseSync.enabled = Boolean(syncStatus?.enabled);
        if (syncStatus?.reason) {
          this.supabaseSync.reason = syncStatus.reason;
          this.supabaseSync.status = "SYNC_NOT_ENABLED";
          this.supabaseSync.connected = false;
        }
        if (syncStatus?.enabled) {
          console.log("[SupabaseSync] Realtime sync is enabled.");
        }

        // 7. Nạp dữ liệu thô từ IndexedDB (Dự án, NCC, CPC, HĐ...)
        const didLoadFromDB = await this.loadDataFromIndexedDB();

        // 8. Nạp thời gian lưu trữ cuối cùng
        const timestampRecord = await getAppStateValue(
          databaseService,
          "lastSaveTimestamp"
        );
        if (timestampRecord) {
          this.lastSaveTimestamp = timestampRecord.value;
        }

        // --- BƯỚC QUAN TRỌNG: GIẢI PHÓNG UI ---
        // Cho phép hiển thị bảng CPC Tracking ngay lập tức với dữ liệu thô đã nạp
        this.isDataLoading = false;
        console.log("[System] Giao diện đã được mở khóa. Đang render bảng Tracking...");

        // 9. Khởi tạo Search Engine (Fuse.js)
        this.initializeFuse();

        // 10. CHẠY TÍNH TOÁN NẶNG NGẦM (BACKGROUND)
        // Việc tính toán lại toàn bộ tab Details sẽ diễn ra sau 300ms 
        // để nhường chỗ cho trình duyệt vẽ xong bảng Tracking
        if (didLoadFromDB) {
          setTimeout(() => {
            console.log("[System] Đang chạy tính toán lũy kế Details ngầm...");
            this._recalculateAllDetailRowsAfterLoad();
          }, 300);
        }

      } catch (error) {
        console.error("Lỗi nghiêm trọng trong quá trình khởi tạo:", error);
        this.isLoadingError = true;
        this.isDataLoading = false;
      }
    },

    mounted() {
      sessionStorage.removeItem("app_resource_retries");

      const savedWidth = localStorage.getItem("notesPanelWidth");
      if (savedWidth) {
        this.notesPanelWidth = parseInt(savedWidth, 10);
      }
      this.$nextTick(() => {
        const modals = document.querySelectorAll(".modal");
        modals.forEach((modalEl) => {
          modalEl.addEventListener("shown.bs.modal", () => {
            const focusRefName = modalEl.dataset.focusRef;

            if (
              modalEl.id === "cpcDetailModal" &&
              this.modalMode !== "add"
            ) {
              return;
            }

            if (focusRefName && this.$refs[focusRefName]) {
              const targetEl = Array.isArray(this.$refs[focusRefName])
                ? this.$refs[focusRefName][0]
                : this.$refs[focusRefName];

              if (targetEl && typeof targetEl.focus === "function") {
                targetEl.focus();
                if (typeof targetEl.select === "function") {
                  targetEl.select();
                }
              }
            }
          });
        });
      });
      this.loadLanguage();
      this.setDefaultDashboardDates();
      this.initializeColumnVisibility();
      this.$refs.mainContentWrapper?.addEventListener(
        "scroll",
        this.handleScroll
      );

      window.addEventListener("keydown", this.handleGlobalKeyDown);
      window.addEventListener("keydown", this.handleQuickMenuShortcut);
      window.addEventListener("keydown", this.handleSidebarShortcut);
      window.addEventListener("keydown", this.handleFilterToggleShortcut);

      const confirmationModalEl =
        document.getElementById("confirmationModal");
      if (confirmationModalEl) {
        confirmationModalEl.addEventListener("shown.bs.modal", () => {
          const contentEl =
            confirmationModalEl.querySelector(".modal-content");
          if (contentEl) {
            contentEl.focus();
          }
        });
      }
      const modalIds = [
        "cpcDetailModal",
        "swapEditModal",
        "contractDetailModal",
        "bondDetailViewModal",
        "bondEditModal",
        "installmentEditModal",
        "renewBondModal",
        "confirmationModal",
        "guideModal",
        "contractDetailsModal",
        "cpcDetailsModal",
        "paymentDetailsModal",
        "invoiceDetailsModal",
        "statusUpdateModal",
      ];
      modalIds.forEach((id) => {
        const modalEl = document.getElementById(id);
        if (modalEl) {
          modalEl.addEventListener("hidden.bs.modal", () =>
            this.clearModalData(id)
          );
        }
      });

      const cpcDetailModalEl = document.getElementById("cpcDetailModal");
      if (cpcDetailModalEl) {
        cpcDetailModalEl.addEventListener("shown.bs.modal", () => {
          if (this.modalMode === 'financials' && this.shouldFocusPaymentDate) {
            this.$nextTick(() => {
              const firstDateInput = cpcDetailModalEl.querySelector('input[type="date"]');
              if (firstDateInput) {
                firstDateInput.focus();
              }
              this.shouldFocusPaymentDate = false; // Reset cờ
            });
            return;
          }

          if (this.modalMode === 'add') {
            const projectInput = this.$refs.projectInput;
            if (projectInput) projectInput.focus();
          }
        });
      }

      this.tooltipInstance = new bootstrap.Tooltip(document.body, {
        selector: "[data-bs-toggle='tooltip']",
      });

      this.$nextTick(() => {
        lucide.createIcons();
      });
    },
    beforeUnmount() {
      window.removeEventListener("mousemove", this.doResize);
      window.removeEventListener("mouseup", this.stopResize);

      this.$refs.mainContentWrapper?.removeEventListener(
        "scroll",
        this.handleScroll
      );
      window.removeEventListener("keydown", this.handleGlobalKeyDown);
      window.removeEventListener("keydown", this.handleQuickMenuShortcut);
      window.removeEventListener("keydown", this.handleSidebarShortcut);
      window.removeEventListener(
        "keydown",
        this.handleFilterToggleShortcut
      );
    },
    watch: {
      'currentEditContract.currency': function (newVal) {
        // Nếu chuyển sang USD và đang có đối tượng contract trong modal
        if (newVal === 'USD' && this.currentEditContract) {
          if (!this.currentEditContract.settings) {
            this.currentEditContract.settings = {
              repaymentThreshold: 80,
              retentionRate: 5,
              defaultVatRate: 0
            };
          } else {
            // Tự động gán VAT mặc định bằng 0 khi là USD
            this.currentEditContract.settings.defaultVatRate = 0;
          }
        } else if (newVal === 'VND' && this.currentEditContract?.settings?.defaultVatRate === 0) {
          // Tùy chọn: Nếu chuyển ngược lại VND và đang là 0, có thể gợi ý về 8 hoặc 10
          this.currentEditContract.settings.defaultVatRate = 8;
        }
      },
      "viewStates.invoiceAging.filter.projectId": {
        handler(newIds) {
          if (newIds && newIds.length > 0) {
            console.log(
              "Đang đồng bộ dữ liệu thanh toán cho Dự án được chọn..."
            );

            const contractsToSync = this.contracts.filter((c) =>
              newIds.includes(c.projectId)
            );

            contractsToSync.forEach((c) => {
              this.syncPaymentsToDetails(c.id);
            });
          }
        },
        deep: true,
      },
      "viewStates.cpcDetails.activePhaseId": {
        async handler(newPhaseId) {
          if (!newPhaseId || newPhaseId === "summary") return;

          const contractId =
            this.viewStates.cpcDetails.filter.selectedContractId;
          if (!contractId) return;

          const hasRows = this.cpcDetailRows.some(
            (r) => r.contractId === contractId && r.phaseId === newPhaseId
          );

          if (!hasRows) {
            console.log(
              `Phase ${newPhaseId} chưa có dữ liệu. Đang khởi tạo dòng trống...`
            );

            const newRows = [];
            for (let i = 0; i < 5; i++) {
              newRows.push(this.createEmptyDetailRow(contractId, i));
            }

            try {
              const persistedRows = await addDetailRows(databaseService, newRows);
              this.cpcDetailRows.push(...persistedRows);

              this.showToast(
                "Đã khởi tạo các dòng trống cho giai đoạn mới.",
                "success"
              );
            } catch (error) {
              console.error("Lỗi khi khởi tạo dòng cho Phase:", error);
            }
          }
        },
      },
      currentTab(newTab, oldTab) {
        this.$nextTick(() => {
          lucide.createIcons();

          if (
            newTab === "cpc-details" &&
            this.viewStates.cpcDetails.filter.selectedContractId
          ) {
            this.syncPaymentsToDetails(
              this.viewStates.cpcDetails.filter.selectedContractId
            );
          }

          if (
            newTab === "invoice-aging" &&
            this.viewStates.invoiceAging.filter.projectId.length === 0
          ) {
            this.viewStates.invoiceAging.isFilterCollapsed = false;
            this.viewStates.invoiceAging.filter.expansion.project = false;
          }

          if (
            newTab === "invoice-aging" &&
            this.viewStates.invoiceAging.filter.projectId.length > 0
          ) {
            const selectedProjectIds =
              this.viewStates.invoiceAging.filter.projectId;
            const contractsToSync = this.contracts.filter((c) =>
              selectedProjectIds.includes(c.projectId)
            );
            contractsToSync.forEach((c) => {
              this.syncPaymentsToDetails(c.id);
            });
          }
        });
      },

      selectedContractDetails(newContractDetails, oldContractDetails) {
        if (
          this.isNotesModalVisible &&
          newContractDetails?.id !== oldContractDetails?.id
        ) {
          this.initializeNotesForContract(newContractDetails);
        }
      },

      projectQuickFilterSearch(newValue, oldValue) {
        if (newValue !== oldValue) {
          this.activeProjectQuickFilterIndex = 0;
        }
      },
      language() {
        this.initializeFuse();
        this.$nextTick(() => {
          this.tooltipInstance?.dispose();
          this.tooltipInstance = new bootstrap.Tooltip(document.body, {
            selector: "[data-bs-toggle='tooltip']",
          });
          lucide.createIcons();
        });
      },
      vendorSearchTerm(newValue) {
        if (this.isVendorDropdownVisible) {
          if (newValue) {
            const normalizedSearch =
              appUtils.text.normalizeVietnamese(newValue);
            this.filteredVendors = this.vendors
              .filter(
                (vendor) =>
                  appUtils.text
                    .normalizeVietnamese(vendor.name)
                    .includes(normalizedSearch) ||
                  (vendor.abbrName &&
                    appUtils.text
                      .normalizeVietnamese(vendor.abbrName)
                      .includes(normalizedSearch)) ||
                  (vendor.vendorNo && vendor.vendorNo.includes(newValue))
              )
              .slice(0, 10);
          } else {
            this.filteredVendors = this.vendors.slice(0, 10);
          }
        }
        this.activeVendorIndex = -1;
      },
      "viewStates.vendorBalance.searchTerm"() {
        this.viewStates.vendorBalance.currentPage = 1;
      },
      "viewStates.cpcDetails.filter.projectId": {
        deep: true,
        handler() {
          this.viewStates.cpcDetails.filter.selectedContractId = null;
        },
      },
      "viewStates.cpcDetails.filter.vendorId": {
        deep: true,
        handler() {
          this.viewStates.cpcDetails.filter.selectedContractId = null;
        },
      },
      "viewStates.cpcDetails.filter.selectedContractId": {
        async handler(newContractId, oldContractId) {
          this.viewStates.cpcDetails.activePhaseId = "summary";
          if (newContractId && newContractId !== oldContractId) {
            if (this.isDataLoading) {
              return;
            }

            const existingRowCount = this.cpcDetailRows.filter(
              (r) => r.contractId === newContractId
            ).length;

            if (existingRowCount === 0) {
              console.log(
                `Không tìm thấy dòng chi tiết nào cho HĐ ${newContractId}. Khởi tạo 5 dòng trống ban đầu.`
              );
              const newTable = Array.from({ length: 5 }, (_, i) =>
                this.createEmptyDetailRow(newContractId, i)
              );

              try {
                const persistedRows = await addDetailRows(databaseService, newTable);
                this.cpcDetailRows.push(...persistedRows);
              } catch (error) {
                console.error(
                  "Lỗi khi thêm các dòng chi tiết ban đầu:",
                  error
                );
              }
            }

            this.loadContractColumnSettings(newContractId);
            this.syncPaymentsToDetails(newContractId);
          }
        },
        deep: true,
      },

      "viewStates.cpcTracking.searchTerm"() {
        this.viewStates.cpcTracking.currentPage = 1;
      },
      "viewStates.cpcTracking.filter.projectId": {
        handler() {
          this.viewStates.cpcTracking.filter.vendorId = [];
          this.viewStates.cpcTracking.filter.contractId = [];
          this.viewStates.cpcTracking.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.cpcTracking.filter.vendorId": {
        handler() {
          this.viewStates.cpcTracking.filter.contractId = [];
          this.viewStates.cpcTracking.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.cpcTracking.filter.contractId": {
        handler() {
          this.viewStates.cpcTracking.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.cpcTracking.filter.status": {
        handler() {
          this.viewStates.cpcTracking.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.vendorBalance.filter.projectId": {
        handler() {
          this.viewStates.vendorBalance.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.vendorBalance.filter.status": {
        handler() {
          this.viewStates.vendorBalance.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.vendorBalance.filter.balanceStatus": {
        handler() {
          this.viewStates.vendorBalance.currentPage = 1;
        },
      },
      "viewStates.vendorBalance.filter.asOfDate": {
        handler() {
          this.viewStates.vendorBalance.currentPage = 1;
        },
      },

      "masterData.vendors.searchTerm"() {
        this.masterData.vendors.currentPage = 1;
      },
      "masterData.projects.searchTerm"() {
        this.masterData.projects.currentPage = 1;
      },

      language() {
        this.$nextTick(() => {
          this.tooltipInstance?.dispose();
          this.tooltipInstance = new bootstrap.Tooltip(document.body, {
            selector: "[data-bs-toggle='tooltip']",
          });
          lucide.createIcons();
        });
      },
      "viewStates.paymentDashboard.filter.projectId": {
        handler() {
          this.viewStates.paymentDashboard.filter.vendorId = [];
          this.viewStates.paymentDashboard.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.paymentDashboard.filter.vendorId": {
        handler() {
          this.viewStates.paymentDashboard.filter.code = [];
          this.viewStates.paymentDashboard.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.paymentDashboard.filter.code": {
        handler() {
          this.viewStates.paymentDashboard.filter.paymentSource = [];
          this.viewStates.paymentDashboard.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.swapDashboard.filter.projectId": {
        handler() {
          this.viewStates.swapDashboard.filter.vendorId = [];
          this.viewStates.swapDashboard.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.swapDashboard.filter.vendorId": {
        handler() {
          this.viewStates.swapDashboard.filter.vendorSWAP = [];
          this.viewStates.swapDashboard.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.bondDashboard.filter.projectId": {
        handler() {
          this.viewStates.bondDashboard.filter.vendorId = [];
          this.viewStates.bondDashboard.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.bondDashboard.filter.vendorId": {
        handler() {
          this.viewStates.bondDashboard.filter.contractId = [];
          this.viewStates.bondDashboard.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.bondDashboard.filter.contractId": {
        handler() {
          this.viewStates.bondDashboard.filter.bondType = [];
          this.viewStates.bondDashboard.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.contractDashboard.filter.projectId": {
        handler() {
          this.viewStates.contractDashboard.filter.vendorId = [];
          this.viewStates.contractDashboard.filter.contractId = [];
          this.viewStates.contractDashboard.filter.code = [];
          this.viewStates.contractDashboard.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.contractDashboard.filter.vendorId": {
        handler() {
          this.viewStates.contractDashboard.filter.contractId = [];
          this.viewStates.contractDashboard.filter.code = [];
          this.viewStates.contractDashboard.currentPage = 1;
        },
        deep: true,
      },
      "viewStates.contractDashboard.filter.contractId": {
        handler() {
          this.viewStates.contractDashboard.filter.code = [];
          this.viewStates.contractDashboard.currentPage = 1;
        },
        deep: true,
      },

      columnVisibility: {
        handler() {
          this.saveColumnVisibilityToLocalStorage("cpc");
        },
        deep: true,
      },
      dashboardPaymentColumnVisibility: {
        handler() {
          this.saveColumnVisibilityToLocalStorage("dashboardPayment");
        },
        deep: true,
      },
      swapDashboardColumnVisibility: {
        handler() {
          this.saveColumnVisibilityToLocalStorage("swapDashboard");
        },
        deep: true,
      },
      dashboardBondColumnVisibility: {
        handler() {
          this.saveColumnVisibilityToLocalStorage("dashboardBond");
        },
        deep: true,
      },
      contractDashboardColumnVisibility: {
        handler() {
          this.saveColumnVisibilityToLocalStorage("contractDashboard");
        },
        deep: true,
      },

      commandSearchTerm(newValue) {
        this.activeCommandIndex = 0;
        this.debouncedSearch(newValue);
      },

      "currentEditItem.isUsd"(isUsd) {
        if (this.isModalInitializing) return;
        if (isUsd) {
          this.calculateVndFromUsd();
        }
      },
      "currentDetailItem.contractPercentVat": function (
        newValue,
        oldValue
      ) {
        if (
          this.isModalInitializing ||
          newValue === oldValue ||
          !this.currentDetailItem
        )
          return;
        this.updateFormulasInModal("contractVat", false);
      },
      "currentDetailItem.cpcPercentPoW": function (newValue, oldValue) {
        if (
          this.isModalInitializing ||
          newValue === oldValue ||
          !this.currentDetailItem
        )
          return;
        this.updateFormulasInModal("cpcPaymentOfWorkdone", false);
      },
      "currentDetailItem.cpcPercentAdv": function (newValue, oldValue) {
        if (
          this.isModalInitializing ||
          newValue === oldValue ||
          !this.currentDetailItem
        )
          return;
        this.updateFormulasInModal("cpcAdvance", false);
      },
      "currentDetailItem.useWorkdoneForRepayment": function (
        newValue,
        oldValue
      ) {
        if (
          this.isModalInitializing ||
          newValue === oldValue ||
          !this.currentDetailItem
        )
          return;
        this.updateFormulasInModal("cpcRepayment", false);
      },
      "currentDetailItem.cpcPercentVat": function (newValue, oldValue) {
        if (
          this.isModalInitializing ||
          newValue === oldValue ||
          !this.currentDetailItem
        )
          return;
        if (this.isVatOverrideVisible) {
          this.currentDetailItem.isVatRateManual = true;
        }
        this.updateFormulasInModal("cpcVat", false);
      },
      "currentDetailItem.isFinalSettlement": function (newValue, oldValue) {
        if (
          this.isModalInitializing ||
          newValue === oldValue ||
          !this.currentDetailItem
        )
          return;
        this.calculateFinalSettlement();
      },
    },
    computed: {
      isAdminUser() {
        return this.currentUserRoles.includes("x3.admin");
      },
      currentUserDisplayName() {
        return (
          this.currentUserProfile?.name ||
          this.currentUserProfile?.username ||
          "Unknown user"
        );
      },
      currentUserEmail() {
        return this.currentUserProfile?.username || "";
      },
      currentUserRolesText() {
        if (!Array.isArray(this.currentUserRoles) || this.currentUserRoles.length === 0) {
          return "no-role";
        }
        return this.currentUserRoles.join(", ");
      },
      supabaseSyncBadgeClass() {
        if (!this.supabaseSync.enabled) return "bg-secondary";
        if (this.supabaseSync.connected) return "bg-success";
        return "bg-danger";
      },
      supabaseSyncLabel() {
        if (!this.supabaseSync.enabled) return "Supabase: Off";
        if (this.supabaseSync.connected) return "Supabase: Connected";
        return "Supabase: Disconnected";
      },
      supabaseSyncHint() {
        const reason = (this.supabaseSync.reason || "").trim();
        const status = (this.supabaseSync.status || "").trim();
        if (reason) return `${status} - ${reason}`;
        return status || "No status";
      },
      supabaseLastEventLabel() {
        if (!this.supabaseSync.lastEventAt) return "";
        const d = new Date(this.supabaseSync.lastEventAt);
        if (Number.isNaN(d.getTime())) return this.supabaseSync.lastEventAt;
        return d.toLocaleString("vi-VN");
      },
      currentTabTitle() {
        const activeTab = this.sidebarTabs.find((tab) => tab.key === this.currentTab);
        if (activeTab?.label) return activeTab.label;
        return this.t(this.currentTab.replace(/-/g, ""));
      },
      assignableRoles() {
        const rolePermissions = APP_CONFIG?.auth?.rolePermissions || {};
        const roles = Object.keys(rolePermissions).filter(Boolean);
        if (roles.length > 0) return roles;
        return ["x3.viewer", "x3.editor", "x3.admin"];
      },
      effectiveRoleByEmail() {
        const fromConfig = APP_CONFIG?.auth?.google?.roleByEmail || {};
        const fromOverrides = this.adminAccess?.roleOverrides || {};
        const normalized = {};
        Object.entries({ ...fromConfig, ...fromOverrides }).forEach(
          ([email, role]) => {
            const normalizedEmail = (email || "").toString().trim().toLowerCase();
            const normalizedRole = (role || "").toString().trim().toLowerCase();
            if (normalizedEmail && normalizedRole) {
              normalized[normalizedEmail] = normalizedRole;
            }
          }
        );
        return normalized;
      },
      adminRoleAssignments() {
        return Object.entries(this.effectiveRoleByEmail)
          .map(([email, role]) => ({
            email,
            role,
            source: Object.prototype.hasOwnProperty.call(
              this.adminAccess.roleOverrides || {},
              email
            )
              ? "custom"
              : "config",
          }))
          .sort((a, b) => a.email.localeCompare(b.email));
      },
      filteredAdminRoleAssignments() {
        const term = (this.adminAccess.searchTerm || "").trim().toLowerCase();
        if (!term) return this.adminRoleAssignments;
        return this.adminRoleAssignments.filter(
          (item) =>
            item.email.includes(term) ||
            item.role.includes(term) ||
            item.source.includes(term)
        );
      },
      totalContractDashboardMetrics() {
        const totals = {
          contractAmountTotal: 0,
          vonTotal: 0,
          contractVatTotal: 0,
          contractGrandTotal: 0,
          paidAmountExclVAT: 0,
          paidVatAmount: 0,
          paidAmountInclVAT: 0,
          invoiceAmountTotal: 0,
          invoiceVatTotal: 0,
          invoiceGrandTotal: 0
        };

        // Chỉ tính toán nếu có dữ liệu
        if (this.filteredContractDashboardData && this.filteredContractDashboardData.length > 0) {
          this.filteredContractDashboardData.forEach(item => {
            Object.keys(totals).forEach(key => {
              // Cộng dồn giá trị số, nếu không phải số thì coi như 0
              totals[key] += (Number(item[key]) || 0);
            });
          });
        }

        return totals;
      },
      vendorPartnerList() {
        if (!this.viewStates?.vendorPartner) return [];

        const search = this.viewStates.vendorPartner?.searchTerm?.trim().toLowerCase() || "";

        // Nếu không nhập hoặc nhập quá ngắn (< 2 ký tự), trả về mảng rỗng ngay lập tức
        if (search.length < 2) return [];

        // Chỉ thực hiện lọc khi có từ khóa tìm kiếm
        return this.vendors.filter(v => {
          return v.name.toLowerCase().includes(search) ||
            (v.vendorNo && v.vendorNo.toLowerCase().includes(search));
        }).map(v => {
          // Chỉ đếm số hợp đồng, không tính toán sâu để sidebar luôn mượt
          return {
            id: v.id,
            name: v.name,
            contractCount: this.contracts.filter(c => c.vendorId === v.id).length
          };
        });
      },

      selectedVendorData() {
        const vId = this.viewStates.vendorPartner?.selectedId;
        if (!vId) return null;

        const vendor = this.vendors.find(v => v.id === vId);
        if (!vendor) return null;

        const vendorContracts = this.contracts.filter(c => c.vendorId === vId);
        const contractIds = new Set(vendorContracts.map(c => c.id));
        const allRelatedRows = this.cpcDetailRows.filter(r => contractIds.has(r.contractId));

        let totalCpcOutstanding = 0;
        let totalAdvBalance = 0;
        let totalRetention = 0;
        let totalBudget = 0;
        let totalWorkdone = 0;

        const detailedContracts = vendorContracts.map(c => {
          const rows = allRelatedRows.filter(r => r.contractId === c.id);

          // Tính toán cho từng hợp đồng
          const cBudget = rows.reduce((s, r) => s + (Number(r.contractAmount) || 0) + (Number(r.contractVon) || 0), 0);
          const cWD = rows.reduce((s, r) => s + (Number(r.cpcWorkDone) || 0), 0);

          // 1. Công nợ CPC chưa trả = (Số đề nghị + VAT) - Thực chi
          const cCpcDue = rows.reduce((s, r) => s + (Number(r.cpcAmountDue) || 0) + (Number(r.cpcVat) || 0), 0);
          const cPaid = rows.reduce((s, r) => s + (Number(r.paymentGrandTotal) || 0), 0);
          const cOutstanding = cCpcDue - cPaid;

          // 2. Dư nợ tạm ứng = (Tạm ứng dương) - (Khấu trừ repayment) - (Tạm ứng âm)
          const cPosAdv = rows.reduce((s, r) => (Number(r.cpcAdvance) > 0 ? s + Number(r.cpcAdvance) : s), 0);
          const cRepay = rows.reduce((s, r) => s + Math.abs(Number(r.cpcRepayment) || 0), 0);
          const cNegAdv = rows.reduce((s, r) => (Number(r.cpcAdvance) < 0 ? s + Math.abs(Number(r.cpcAdvance)) : s), 0);
          const cAdvBal = cPosAdv - (cRepay + cNegAdv);

          // 3. Bảo hành giữ lại
          const cRetention = rows.reduce((s, r) => s + Math.abs(Number(r.cpcRetention) || 0), 0);

          // Cộng dồn vào tổng Vendor
          totalCpcOutstanding += cOutstanding;
          totalAdvBalance += cAdvBal;
          totalRetention += cRetention;
          totalBudget += cBudget;
          totalWorkdone += cWD;

          return {
            id: c.id,
            contractNo: c.contractNo,
            projectId: c.projectId, // Đảm bảo có dòng này
            vendorId: c.vendorId,   // Đảm bảo có dòng này
            description: c.description,
            status: c.status || 'Active',
            projectName: this.projectMap.get(c.projectId)?.name || 'N/A',
            budget: cBudget,
            workdone: cWD,
            outstanding: cOutstanding,
            advBalance: cAdvBal,
            progress: cBudget > 0 ? Math.round((cWD / cBudget) * 100) : 0
          };
        });

        return {
          vendor,
          contracts: detailedContracts,
          totalCpcOutstanding,
          totalAdvBalance,
          totalRetention,
          overallProgress: totalBudget > 0 ? Math.round((totalWorkdone / totalBudget) * 100) : 0,
          projectCount: [...new Set(vendorContracts.map(c => c.projectId))].length
        };
      },

      overviewBonds() {
        if (!this.selectedContractDetails) return [];
        // Lọc: Đúng hợp đồng + Chưa tất toán + Chưa bị gia hạn (chỉ lấy bản mới nhất)
        return this.bonds.filter(b =>
          b.contractId === this.selectedContractDetails.id &&
          !b.isSettled &&
          !b.isRenewed
        ).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
      },
      historySummaryRows() {
        const allCpcs = this.groupedContractHistoryTable;
        const init = () => ({
          workDone: 0, paymentOfWorkdone: 0, advance: 0, repayment: 0,
          retention: 0, otherDeduction: 0, amountDue: 0, amountPaid: 0, count: 0
        });

        const summary = {
          paid: { label: 'TỔNG CÁC ĐỢT ĐÃ THANH TOÁN XONG', ...init() },
          processing: { label: 'TỔNG CÁC ĐỢT ĐANG XỬ LÝ / DỞ DANG', ...init() }
        };

        allCpcs.forEach(item => {
          const isPaid = item.amountPaid >= item.amountDue && item.amountDue > 0;
          const target = isPaid ? summary.paid : summary.processing;

          Object.keys(init()).forEach(key => {
            if (key !== 'count') target[key] += item[key];
          });
          target.count++;
        });

        return summary;
      },
      groupedContractHistoryTable() {
        const contractId = this.viewStates.cpcDetails.filter.selectedContractId;
        if (!contractId) return [];

        const rows = this.cpcDetailRows.filter(r => r.contractId === contractId && r.cpcNo);
        const groups = {};

        rows.forEach(row => {
          const cpc = row.cpcNo.trim();
          if (!groups[cpc]) {
            groups[cpc] = {
              id: cpc,
              cpcNo: cpc,
              description: row.description,
              workDone: 0,
              paymentOfWorkdone: 0,
              advance: 0,
              repayment: 0,
              retention: 0,
              otherDeduction: 0,
              amountDue: 0,
              amountPaid: 0
            };
          }

          groups[cpc].workDone += (Number(row.cpcWorkDone) || 0);
          groups[cpc].paymentOfWorkdone += (Number(row.cpcPaymentOfWorkdone) || 0);
          groups[cpc].advance += (Number(row.cpcAdvance) || 0);
          groups[cpc].repayment += (Number(row.cpcRepayment) || 0);
          groups[cpc].retention += (Number(row.cpcRetention) || 0);
          groups[cpc].otherDeduction += (Number(row.cpcOtherDeduction) || 0);

          groups[cpc].amountDue += (Number(row.cpcAmountDue) || 0) + (Number(row.cpcVat) || 0);

          groups[cpc].amountPaid += (Number(row.paymentGrandTotal) || 0);
        });

        return Object.values(groups).sort((a, b) => {
          const extractNum = (s) => {
            const match = String(s).match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          };
          return extractNum(a.cpcNo) - extractNum(b.cpcNo);
        });
      },
      contractOverviewData() {
        const contractId = this.viewStates.cpcDetails.filter.selectedContractId;
        if (!contractId || !this.selectedContractDetails) return null;

        const rows = this.cpcDetailRows.filter(r => r.contractId === contractId);

        const budgetAmountExclVat = rows.reduce((sum, r) => {
          return sum + (Number(r.contractAmount) || 0) + (Number(r.contractVon) || 0);
        }, 0);

        const totalValueInclVat = rows.reduce((sum, r) => {
          return sum +
            (Number(r.contractAmount) || 0) +
            (Number(r.contractVon) || 0) +
            (Number(r.contractVat) || 0);
        }, 0);

        const totalWorkdone = rows.reduce((sum, r) => sum + (Number(r.cpcWorkDone) || 0), 0);
        const progressPercent = budgetAmountExclVat > 0 ? Math.round((totalWorkdone / budgetAmountExclVat) * 100) : 0;

        const positiveAdvanceRows = rows.filter(r => (Number(r.cpcAdvance) || 0) > 0);
        const groupedPositiveAdvances = {};
        positiveAdvanceRows.forEach(row => {
          const cpcKey = row.cpcNo || 'Unnumbered';
          if (!groupedPositiveAdvances[cpcKey]) {
            const firstDate = (row.paymentInstallments || []).map(i => i.date).filter(d => d).sort()[0] || '9999-12-31';
            groupedPositiveAdvances[cpcKey] = { amount: 0, date: firstDate };
          }
          groupedPositiveAdvances[cpcKey].amount += Number(row.cpcAdvance) || 0;
        });

        const advanceTimeline = Object.values(groupedPositiveAdvances).sort((a, b) => a.date.localeCompare(b.date));
        const initialAdvance = advanceTimeline.length > 0 ? advanceTimeline[0].amount : 0;
        const additionalAdvance = advanceTimeline.length > 1 ? advanceTimeline.slice(1).reduce((sum, item) => sum + item.amount, 0) : 0;
        const totalPositiveAdvance = initialAdvance + additionalAdvance;

        const recoveryFromRepayment = rows.reduce((sum, r) => sum + Math.abs(Number(r.cpcRepayment) || 0), 0);
        const recoveryFromNegativeAdvance = rows.reduce((sum, r) => {
          const val = Number(r.cpcAdvance) || 0;
          return val < 0 ? sum + Math.abs(val) : sum;
        }, 0);

        const totalRecovered = recoveryFromRepayment + recoveryFromNegativeAdvance;

        const currentAdvanceBalance = totalPositiveAdvance - totalRecovered;
        const totalPaid = rows.reduce((sum, r) => sum + (Number(r.paymentGrandTotal) || 0), 0);
        const totalPaymentOfWorkdone = rows.reduce((sum, r) => sum + (Number(r.cpcPaymentOfWorkdone) || 0), 0);
        const retentionValue = totalWorkdone - totalPaymentOfWorkdone;

        return {
          totalContractValue: totalValueInclVat,
          budgetAmount: budgetAmountExclVat,
          totalWorkdone,
          progressPercent,
          totalPaid,
          retentionValue,
          initialAdvance,
          additionalAdvance,
          totalRecovered,
          currentAdvanceBalance,
          remainingValue: budgetAmountExclVat - totalWorkdone
        };
      },

      contractHistoryTable() {
        const contractId = this.viewStates.cpcDetails.filter.selectedContractId;
        if (!contractId) return [];

        return this.cpcDetailRows
          .filter(r => r.contractId === contractId && r.cpcNo)
          .sort((a, b) => {
            const extractNum = (s) => {
              const match = String(s).match(/\d+/);
              return match ? parseInt(match[0], 10) : 0;
            };
            return extractNum(a.cpcNo) - extractNum(b.cpcNo);
          });
      },
      processedContractAgingData() {
        const reportDateStr =
          this.viewStates.invoiceAging.filter.reportDate;
        const reportDate = reportDateStr
          ? new Date(reportDateStr)
          : new Date();
        reportDate.setHours(0, 0, 0, 0);

        const allCpcs = this.processedCpcData;
        const grouped = {};

        allCpcs.forEach((cpc) => {
          const remaining = cpc.amount - (cpc.totalAmountPaid || 0);
          if (remaining <= 100 || !cpc.paymentDueDate) return;

          const dueDate = new Date(cpc.paymentDueDate);
          const diffTime = reportDate - dueDate;
          const age = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (age <= 0) return;

          const contractId = cpc.contractId;
          if (!grouped[contractId]) {
            const contract = this.contractMap.get(contractId) || {};
            const project = this.projectMap.get(cpc.projectId) || {};
            const vendor = this.vendorMap.get(cpc.vendorId) || {};

            grouped[contractId] = {
              id: contractId,
              contractId: contractId,
              projectId: contract.projectId,
              vendorId: contract.vendorId,
              projectName: project.name || "N/A",
              contractDate: contract.date || "",
              contractNo: contract.contractNo || "N/A",
              vendorNo: vendor.vendorNo || "",
              vendorName: vendor.name || "N/A",
              description: contract.description || "",
              age1_30: 0,
              age31_60: 0,
              age61_90: 0,
              ageOver90: 0,
              remainingTotal: 0,
            };
          }

          if (age <= 30) grouped[contractId].age1_30 += remaining;
          else if (age <= 60) grouped[contractId].age31_60 += remaining;
          else if (age <= 90) grouped[contractId].age61_90 += remaining;
          else grouped[contractId].ageOver90 += remaining;

          grouped[contractId].remainingTotal += remaining;
        });

        return Object.values(grouped);
      },

      filteredContractAgingData() {
        const state = this.viewStates.invoiceAging;
        let data = [...this.processedContractAgingData];
        if (state.filter.projectId.length > 0) {
          data = data.filter((item) =>
            state.filter.projectId.includes(item.projectId)
          );
        }
        if (state.filter.vendorId.length > 0) {
          data = data.filter((item) =>
            state.filter.vendorId.includes(item.vendorId)
          );
        }
        if (state.sortBy) {
          data.sort((a, b) => {
            let valA = a[state.sortBy],
              valB = b[state.sortBy];
            if (typeof valA === "number")
              return state.sortDirection === "asc"
                ? valA - valB
                : valB - valA;
            return state.sortDirection === "asc"
              ? String(valA).localeCompare(String(valB))
              : String(valB).localeCompare(String(valA));
          });
        }
        return data;
      },

      paginatedContractAgingData() {
        const state = this.viewStates.invoiceAging;
        return this.filteredContractAgingData.slice(
          (state.currentPage - 1) * state.perPage,
          state.currentPage * state.perPage
        );
      },

      totalContractAgingBuckets() {
        return this.filteredContractAgingData.reduce(
          (acc, item) => {
            acc.age1_30 += item.age1_30;
            acc.age31_60 += item.age31_60;
            acc.age61_90 += item.age61_90;
            acc.ageOver90 += item.ageOver90;
            acc.total += item.remainingTotal;
            return acc;
          },
          { age1_30: 0, age31_60: 0, age61_90: 0, ageOver90: 0, total: 0 }
        );
      },
      overdueCpcs() {
        if (!Array.isArray(this.processedCpcData)) return [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return this.processedCpcData
          .filter((item) => {
            const statusKey = item.statusInfo?.statusKey;
            if (!item.paymentDueDate || statusKey === "complete")
              return false;

            const dueDate = new Date(item.paymentDueDate);
            const isPastDue = dueDate < today;
            const hasBalance =
              item.amount - (item.totalAmountPaid || 0) > 0;

            return isPastDue && hasBalance;
          })
          .sort(
            (a, b) =>
              new Date(b.paymentDueDate) - new Date(a.paymentDueDate)
          );
      },

      partialCpcs() {
        if (!Array.isArray(this.processedCpcData)) return [];

        return this.processedCpcData
          .filter((item) => {
            const totalAmount = item.isUsd ? item.amountUsd : item.amount;

            const paidAmount = item.isUsd
              ? (item.installments || []).reduce((sum, inst) => sum + (inst.amountUsd || 0), 0)
              : item.totalAmountPaid;

            const absTotal = Math.abs(totalAmount);
            const absPaid = Math.abs(paidAmount);

            return absPaid > 0 && absPaid < absTotal;
          })
          .sort(
            (a, b) =>
              new Date(a.paymentDueDate) - new Date(b.paymentDueDate)
          );
      },
      upcomingCpcs() {
        if (!Array.isArray(this.processedCpcData)) return [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const next10Days = new Date();
        next10Days.setDate(today.getDate() + 10);

        return this.processedCpcData
          .filter((item) => {
            const statusKey = item.statusInfo?.statusKey;
            if (!item.paymentDueDate || statusKey === "complete")
              return false;

            const dueDate = new Date(item.paymentDueDate);
            const isUpcoming = dueDate >= today && dueDate <= next10Days;
            const hasBalance =
              item.amount - (item.totalAmountPaid || 0) > 0;

            return isUpcoming && hasBalance;
          })
          .sort(
            (a, b) =>
              new Date(a.paymentDueDate) - new Date(b.paymentDueDate)
          );
      },
      swapDashboardStats() {
        const activeSwaps = this.filteredSwapsDashboard;
        let stats = {
          totalReceivable: 0,
          totalPayable: 0,
          totalSettled: 0,
          count: activeSwaps.length,
        };

        activeSwaps.forEach((s) => {
          if (s.transactionType === "receivable") {
            stats.totalReceivable += s.amount || 0;
          } else {
            stats.totalPayable += s.amount || 0;
          }
          stats.totalSettled += s.totalSwapPaidAmount || 0;
        });
        return stats;
      },

      swapDashboardYear() {
        const startDate = this.viewStates.swapDashboard.filter.startDate;
        if (!startDate) return new Date().getFullYear();
        return new Date(startDate).getFullYear();
      },
      dashboardStats() {
        const activeRows = this.filteredPaymentsDashboard;

        let stats = {
          totalVnd: 0,
          totalUsd: 0,
          totalSwap: 0,
          count: activeRows.length,
        };

        activeRows.forEach((p) => {
          if (p.isSwapRow) {
            stats.totalSwap += p.amount || 0;
          } else {
            if (p.isUsd) {
              stats.totalUsd += p.amountUsd || 0;
            } else {
              stats.totalVnd += p.amount || 0;
            }
          }
        });

        return stats;
      },

      paymentDashboardYear() {
        const startDate = this.viewStates.paymentDashboard.filter.startDate;
        if (!startDate) return new Date().getFullYear();
        return new Date(startDate).getFullYear();
      },
      invoiceAgingColumns() {
        return [
          { key: "projectName", label: this.t("project") },
          { key: "contractNo", label: this.t("contract") },
          { key: "contractDate", label: this.t("date") + " (HĐ)" },
          {
            key: "contractDescription",
            label: this.t("details") + " (HĐ)",
          },
          { key: "vendorNo", label: this.t("vendorNo") },
          { key: "vendorName", label: this.t("vendor") },
          { key: "invoiceNo", label: this.t("invoiceNoLabel") },
          { key: "invoiceDate", label: this.t("date") },
          { key: "invoicePostingDate", label: this.t("postingDate") },
          {
            key: "age",
            label: this.t("ageDays"),
            class: "text-center-custom",
          },
          {
            key: "remainingNet",
            label: this.t("remainingNet"),
            class: "text-end-custom",
          },
          {
            key: "remainingVat",
            label: this.t("remainingVat"),
            class: "text-end-custom",
          },
          {
            key: "remainingTotal",
            label: this.t("remainingTotal"),
            class: "text-end-custom",
          },
        ];
      },

      processedInvoiceAgingData() {
        const reportDateStr =
          this.viewStates.invoiceAging.filter.reportDate;
        const reportDate = reportDateStr
          ? new Date(reportDateStr)
          : new Date();
        reportDate.setHours(0, 0, 0, 0);

        return this.cpcDetailRows
          .filter((row) => {
            const contract = this.contractMap.get(row.contractId);
            const selectedProjectIds =
              this.viewStates.invoiceAging.filter.projectId;
            if (
              selectedProjectIds.length > 0 &&
              (!contract ||
                !selectedProjectIds.includes(contract.projectId))
            )
              return false;
            if (!row.invoiceNo) return false;
            const remaining =
              (row.invoiceTotal || 0) - (row.paymentGrandTotal || 0);
            return remaining > 100;
          })
          .map((row) => {
            const contract = this.contractMap.get(row.contractId) || {};
            const project = this.projectMap.get(contract.projectId) || {};
            const vendor = this.vendorMap.get(contract.vendorId) || {};

            let age = 0;
            if (row.invoicePostingDate) {
              const pDate = new Date(row.invoicePostingDate);
              const diffTime = reportDate - pDate;
              age = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            return {
              id: row.id,
              contractId: row.contractId,
              projectId: contract.projectId,
              vendorId: contract.vendorId,
              projectName: project.name || "N/A",
              contractNo: contract.contractNo || "N/A",
              contractDate: contract.date || "",
              contractDescription: contract.description || "",
              vendorNo: vendor.vendorNo || "",
              vendorName: vendor.name || "N/A",
              invoiceNo: row.invoiceNo.trim(),
              invoiceDate: row.invoiceDate,
              invoicePostingDate: row.invoicePostingDate,
              age: age,
              remainingNet:
                (row.invoiceAmount || 0) - (row.paymentTotalAmount || 0),
              remainingVat:
                (row.invoiceVat || 0) - (row.paymentTotalVat || 0),
              remainingTotal:
                (row.invoiceTotal || 0) - (row.paymentGrandTotal || 0),
            };
          });

        const groupedMap = new Map();

        rawList.forEach((item) => {
          const key = `${item.contractNo}_${item.invoiceNo}_${item.invoiceDate}_${item.invoicePostingDate}`;

          if (!groupedMap.has(key)) {
            groupedMap.set(key, { ...item, id: key });
          } else {
            const existing = groupedMap.get(key);
            existing.remainingNet += item.remainingNet;
            existing.remainingVat += item.remainingVat;
            existing.remainingTotal += item.remainingTotal;

            if (
              existing.projectName !== item.projectName &&
              !existing.projectName.includes(item.projectName)
            ) {
              existing.projectName += `, ${item.projectName}`;
            }
          }
        });

        return Array.from(groupedMap.values()).map((item) => ({
          ...item,
          remainingNetFormatted: this.formatCurrency(item.remainingNet),
          remainingVatFormatted: this.formatCurrency(item.remainingVat),
          remainingTotalFormatted: this.formatCurrency(item.remainingTotal),
        }));
      },

      filteredInvoiceAgingData() {
        const state = this.viewStates.invoiceAging;
        let data = [...this.processedInvoiceAgingData];

        if (state.filter.projectId.length > 0) {
          data = data.filter((item) =>
            state.filter.projectId.includes(item.projectId)
          );
        }
        if (state.filter.vendorId.length > 0) {
          data = data.filter((item) =>
            state.filter.vendorId.includes(item.vendorId)
          );
        }
        if (state.filter.minAge > 0) {
          data = data.filter((item) => item.age >= state.filter.minAge);
        }

        if (state.sortBy) {
          data.sort((a, b) => {
            let valA = a[state.sortBy];
            let valB = b[state.sortBy];

            if (
              [
                "remainingNet",
                "remainingVat",
                "remainingTotal",
                "age",
              ].includes(state.sortBy)
            ) {
              return state.sortDirection === "asc"
                ? valA - valB
                : valB - valA;
            }
            valA = (valA || "").toString().toLowerCase();
            valB = (valB || "").toString().toLowerCase();
            if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
            if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
            return 0;
          });
        }

        return data;
      },

      paginatedInvoiceAgingData() {
        const state = this.viewStates.invoiceAging;
        const start = (state.currentPage - 1) * state.perPage;
        return this.filteredInvoiceAgingData.slice(
          start,
          start + state.perPage
        );
      },

      totalInvoiceAgingPages() {
        return Math.ceil(
          this.filteredInvoiceAgingData.length /
          this.viewStates.invoiceAging.perPage
        );
      },

      totalInvoiceAging() {
        return this.filteredInvoiceAgingData.reduce(
          (acc, item) => {
            acc.net += item.remainingNet;
            acc.vat += item.remainingVat;
            acc.total += item.remainingTotal;
            return acc;
          },
          { net: 0, vat: 0, total: 0 }
        );
      },

      availableInvoiceAgingProjects() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.projects,
          linkingData: this.contracts,
          linkKey: "projectId",
          searchTerm: this.viewStates.invoiceAging.filter.projectSearch,
          vueInstance: this,
        });
      },

      availableInvoiceAgingVendors() {
        let relevantContracts = this.contracts;

        const selectedProjectIds =
          this.viewStates.invoiceAging.filter.projectId;
        if (selectedProjectIds && selectedProjectIds.length > 0) {
          relevantContracts = relevantContracts.filter((c) =>
            selectedProjectIds.includes(c.projectId)
          );
        }

        return appUtils.filter.getAvailableItems({
          sourceData: this.vendors,
          linkingData: relevantContracts,
          linkKey: "vendorId",
          searchTerm: this.viewStates.invoiceAging.filter.vendorSearch,
          vueInstance: this,
        });
      },
      groupedBondsDashboard() {
        const flatBonds = this.filteredBondsDashboard;
        if (flatBonds.length === 0) return [];

        const groups = {};

        const sortedFlat = [...flatBonds].sort((a, b) => {
          const dateA = new Date(a.expiryDate || "1970-01-01");
          const dateB = new Date(b.expiryDate || "1970-01-01");
          return dateB - dateA;
        });

        sortedFlat.forEach((bond) => {
          const groupKey = `${bond.contractId}_${bond.bondType}`;
          const isExpanded =
            this.viewStates.bondDashboard.expandedGroupKeys.includes(
              groupKey
            );

          if (!groups[groupKey]) {
            groups[groupKey] = {
              groupKey: groupKey,
              latestBond: bond,
              history: [],
              isExpanded: isExpanded,
            };
          } else {
            groups[groupKey].history.push(bond);
          }
        });

        let groupArray = Object.values(groups);

        groupArray.forEach((group) => {
          if (group.history.length > 0) {
            group.history.sort((a, b) => {
              const dateA = new Date(a.expiryDate || "1970-01-01");
              const dateB = new Date(b.expiryDate || "1970-01-01");

              return dateB - dateA;
            });
          }
        });

        const state = this.viewStates.bondDashboard;
        if (state.sortBy) {
          groupArray.sort((groupA, groupB) => {
            const a = groupA.latestBond;
            const b = groupB.latestBond;

            let valA = a[state.sortBy];
            let valB = b[state.sortBy];

            if (valA == null) return 1;
            if (valB == null) return -1;

            if (state.sortBy === "amount") {
              valA = parseFloat(valA);
              valB = parseFloat(valB);
            } else if (["issueDate", "expiryDate"].includes(state.sortBy)) {
              valA = new Date(valA);
              valB = new Date(valB);
              if (isNaN(valA)) return 1;
              if (isNaN(valB)) return -1;
            } else if (typeof valA === "string") {
              valA = valA.toLowerCase();
              valB = valB.toLowerCase();
            }

            if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
            if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
            return 0;
          });
        }

        return groupArray;
      },

      paginatedGroupedBonds() {
        const state = this.viewStates.bondDashboard;
        const start = (state.currentPage - 1) * state.perPage;
        return this.groupedBondsDashboard.slice(
          start,
          start + state.perPage
        );
      },

      groupedBondDashboardTotalPages() {
        return Math.ceil(
          this.groupedBondsDashboard.length /
          this.viewStates.bondDashboard.perPage
        );
      },

      filteredProjectsForContractModal() {
        if (!this.isContractProjectDropdownVisible) return [];

        let candidates = this.projects;

        const searchTerm = this.currentEditContract?.projectName || "";

        if (searchTerm) {
          const normalizedSearch =
            appUtils.text.normalizeVietnamese(searchTerm);
          candidates = candidates.filter((p) =>
            appUtils.text
              .normalizeVietnamese(p.name)
              .includes(normalizedSearch)
          );
        }

        return candidates
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 10);
      },
      filteredProjectsForModal() {
        if (!this.isProjectDropdownVisible) return [];

        let candidates = this.projects;
        const searchTerm = this.currentEditItem?.projectName || "";

        if (searchTerm) {
          const normalizedSearch =
            appUtils.text.normalizeVietnamese(searchTerm);
          candidates = candidates.filter((p) =>
            appUtils.text
              .normalizeVietnamese(p.name)
              .includes(normalizedSearch)
          );
        }

        return candidates
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 10);
      },

      filteredContractsForModal() {
        if (!this.isContractDropdownVisible) return [];

        let candidates = this.contracts;

        const currentProjectName =
          this.currentEditItem?.projectName?.trim();
        if (currentProjectName) {
          const project = this.projects.find(
            (p) => p.name.toLowerCase() === currentProjectName.toLowerCase()
          );
          if (project) {
            candidates = candidates.filter(
              (c) => c.projectId === project.id
            );
          }
        }

        if (this.contractSearchTerm) {
          const normalizedSearch = appUtils.text.normalizeVietnamese(
            this.contractSearchTerm
          );

          candidates = candidates.filter((c) => {
            const vendor = this.vendorMap.get(c.vendorId);
            const vendorName = vendor ? vendor.name : "";

            const fullSearchString = `${c.contractNo} ${vendorName}`;

            return appUtils.text
              .normalizeVietnamese(fullSearchString)
              .includes(normalizedSearch);
          });
        }

        return candidates
          .sort((a, b) => a.contractNo.localeCompare(b.contractNo))
          .slice(0, 10);
      },

      activeNote() {
        if (
          !this.activeNoteTabId ||
          this.currentContractNotes.length === 0
        ) {
          return null;
        }
        return this.currentContractNotes.find(
          (tab) => tab.id === this.activeNoteTabId
        );
      },

      displayCategories() {
        if (!this.reportCategoriesFromDB) return [];

        const sorted = [...this.reportCategoriesFromDB].sort((a, b) =>
          a.code.localeCompare(b.code, undefined, { numeric: true })
        );

        const result = [];
        const parents = sorted.filter((c) => c.level === 1);

        parents.forEach((parent) => {
          result.push(parent);
          const children = sorted.filter(
            (c) => c.parentCode === parent.code
          );
          result.push(...children);
        });

        return result;
      },

      levelOneCategories() {
        return this.reportCategoriesFromDB
          .filter((c) => c.level === 1)
          .sort((a, b) =>
            a.code.localeCompare(b.code, undefined, { numeric: true })
          );
      },

      categoryUsageCount() {
        const counts = {};
        this.reportCategoriesFromDB.forEach(
          (cat) => (counts[cat.code] = 0)
        );
        this.contracts.forEach((contract) => {
          if (contract.code && counts[contract.code] !== undefined) {
            counts[contract.code]++;
          }
        });
        return counts;
      },

      availableReportProjects() {
        const projectIdsInUse = new Set(
          this.contracts.map((c) => c.projectId)
        );

        let activeProjects = this.projects.filter((p) =>
          projectIdsInUse.has(p.id)
        );

        const searchTerm =
          this.viewStates.reportDashboard.filter.projectSearch;

        if (searchTerm) {
          const normalizedSearch = this.normalizeVietnamese(searchTerm);
          activeProjects = activeProjects.filter((p) =>
            this.normalizeVietnamese(p.name).includes(normalizedSearch)
          );
        }

        return activeProjects.sort((a, b) => a.name.localeCompare(b.name));
      },
      isVndViewForUsdContract() {
        return (
          this.isCurrentContractUSD &&
          this.viewStates.cpcDetails.currencyView === "VND"
        );
      },

      projectMap() {
        return new Map(this.projects.map((p) => [p.id, p]));
      },
      vendorMap() {
        return new Map(this.vendors.map((v) => [v.id, v]));
      },
      contractMap() {
        return new Map(this.contracts.map((c) => [c.id, c]));
      },

      installmentsByCpcId() {
        const map = new Map();
        for (const inst of this.installments) {
          if (inst.cpcId) {
            if (!map.has(inst.cpcId)) {
              map.set(inst.cpcId, []);
            }
            map.get(inst.cpcId).push(inst);
          }
        }
        return map;
      },
      bondsByContractId() {
        const map = new Map();
        for (const bond of this.bonds) {
          if (bond.contractId) {
            if (!map.has(bond.contractId)) {
              map.set(bond.contractId, []);
            }
            map.get(bond.contractId).push(bond);
          }
        }
        return map;
      },
      cpcItemsByContractId() {
        const map = new Map();
        for (const cpc of this.cpcItems) {
          if (cpc.contractId) {
            if (!map.has(cpc.contractId)) {
              map.set(cpc.contractId, []);
            }
            map.get(cpc.contractId).push(cpc);
          }
        }
        return map;
      },
      cpcDetailRowsByContractId() {
        const map = new Map();
        for (const row of this.cpcDetailRows) {
          if (row.contractId) {
            if (!map.has(row.contractId)) {
              map.set(row.contractId, []);
            }
            map.get(row.contractId).push(row);
          }
        }
        return map;
      },

      contractByNumberMap() {
        const map = new Map();
        for (const contract of this.contracts) {
          if (contract.contractNo) {
            map.set(contract.contractNo.toLowerCase(), contract);
          }
        }
        return map;
      },
      vendorByNoMap() {
        const map = new Map();
        for (const vendor of this.vendors) {
          if (vendor.vendorNo) {
            map.set(vendor.vendorNo, vendor);
          }
        }
        return map;
      },

      contractsByVendorIdMap() {
        const map = new Map();
        for (const contract of this.contracts) {
          if (contract.vendorId) {
            if (!map.has(contract.vendorId)) {
              map.set(contract.vendorId, []);
            }
            map.get(contract.vendorId).push(contract);
          }
        }
        return map;
      },

      filteredProjectsForQuickFilter() {
        const allProjectsOption = {
          id: "all",
          name: `--- ${this.t("allProjects", {
            default: "All Projects",
          })} ---`,
        };

        const projectIdsInUse = [
          ...new Set(this.processedCpcData.map((item) => item.projectId)),
        ];

        const baseProjects = this.projects
          .filter((p) => projectIdsInUse.includes(p.id))
          .sort((a, b) => a.name.localeCompare(b.name));

        let projectsToShow = [allProjectsOption, ...baseProjects];

        if (this.projectQuickFilterSearch) {
          const normalizedSearch = appUtils.text.normalizeVietnamese(
            this.projectQuickFilterSearch
          );
          projectsToShow = projectsToShow.filter(
            (p) =>
              p.id === "all" ||
              appUtils.text
                .normalizeVietnamese(p.name)
                .includes(normalizedSearch)
          );
        }

        return projectsToShow;
      },
      projectMap() {
        return new Map(this.projects.map((p) => [p.id, p]));
      },
      vendorMap() {
        return new Map(this.vendors.map((v) => [v.id, v]));
      },
      contractMap() {
        return new Map(this.contracts.map((c) => [c.id, c]));
      },
      bankMap() {
        return new Map(this.banks.map((b) => [b.id, b]));
      },
      processedCpcDataMap() {
        return new Map(this.processedCpcData.map((cpc) => [cpc.id, cpc]));
      },

      availableContractProjects() {
        const projectIdsInUse = new Set(
          this.contracts.map((c) => c.projectId)
        );
        return this.projects
          .filter((p) => projectIdsInUse.has(p.id))
          .sort((a, b) => a.name.localeCompare(b.name));
      },
      filteredAvailableContractProjects() {
        const searchTerm =
          this.viewStates.contractDashboard.filter.projectSearch;
        if (!searchTerm) return this.availableContractProjects;
        const normalizedSearch = this.normalizeVietnamese(searchTerm);
        return this.availableContractProjects.filter((p) =>
          this.normalizeVietnamese(p.name).includes(normalizedSearch)
        );
      },
      availableContractVendors() {
        const projectIds =
          this.viewStates.contractDashboard.filter.projectId;
        let relevantContracts = this.contracts;
        if (projectIds.length > 0) {
          relevantContracts = relevantContracts.filter((c) =>
            projectIds.includes(c.projectId)
          );
        }
        const vendorIdsInUse = new Set(
          relevantContracts.map((c) => c.vendorId)
        );
        return this.vendors
          .filter((v) => vendorIdsInUse.has(v.id))
          .sort((a, b) => a.name.localeCompare(b.name));
      },
      filteredAvailableContractVendors() {
        const searchTerm =
          this.viewStates.contractDashboard.filter.vendorSearch;
        if (!searchTerm) return this.availableContractVendors;
        const normalizedSearch = this.normalizeVietnamese(searchTerm);
        return this.availableContractVendors.filter((v) =>
          this.normalizeVietnamese(v.name).includes(normalizedSearch)
        );
      },
      availableContractContracts() {
        let relevantContracts = this.contracts;
        const projectIds =
          this.viewStates.contractDashboard.filter.projectId;
        const vendorIds = this.viewStates.contractDashboard.filter.vendorId;
        if (projectIds.length > 0) {
          relevantContracts = relevantContracts.filter((c) =>
            projectIds.includes(c.projectId)
          );
        }
        if (vendorIds.length > 0) {
          relevantContracts = relevantContracts.filter((c) =>
            vendorIds.includes(c.vendorId)
          );
        }
        return relevantContracts.sort((a, b) =>
          a.contractNo.localeCompare(b.contractNo)
        );
      },
      filteredAvailableContractContracts() {
        const searchTerm =
          this.viewStates.contractDashboard.filter.contractNoSearch;
        if (!searchTerm) return this.availableContractContracts;
        return this.availableContractContracts.filter((c) =>
          c.contractNo.toLowerCase().includes(searchTerm.toLowerCase())
        );
      },
      availableCodesForContract() {
        let relevantContracts = this.contracts;
        const { projectId, vendorId, contractId } =
          this.viewStates.contractDashboard.filter;
        if (projectId.length > 0) {
          relevantContracts = relevantContracts.filter((c) =>
            projectId.includes(c.projectId)
          );
        }
        if (vendorId.length > 0) {
          relevantContracts = relevantContracts.filter((c) =>
            vendorId.includes(c.vendorId)
          );
        }
        if (contractId.length > 0) {
          relevantContracts = relevantContracts.filter((c) =>
            contractId.includes(c.id)
          );
        }
        return [
          ...new Set(
            relevantContracts.map((item) => item.code).filter(Boolean)
          ),
        ].sort();
      },
      filteredAvailableContractCodes() {
        const searchTerm =
          this.viewStates.contractDashboard.filter.codeSearch;
        if (!searchTerm) return this.availableCodesForContract;
        return this.availableCodesForContract.filter((c) =>
          c.toLowerCase().includes(searchTerm.toLowerCase())
        );
      },

      filteredBondContractsForModal() {
        if (!this.bondContractSearchTerm || this.bondModalMode === "edit") {
          return [];
        }
        const normalizedSearch = appUtils.text.normalizeVietnamese(
          this.bondContractSearchTerm
        );
        return this.contracts
          .filter((contract) => {
            const vendor = this.vendorMap.get(contract.vendorId);
            const searchText = `${contract.contractNo} ${vendor ? vendor.name : ""
              }`;
            return appUtils.text
              .normalizeVietnamese(searchText)
              .includes(normalizedSearch);
          })
          .sort((a, b) => a.contractNo.localeCompare(b.contractNo))
          .slice(0, 10);
      },
      projectMap() {
        return new Map(this.projects.map((p) => [p.id, p]));
      },
      vendorMap() {
        return new Map(this.vendors.map((v) => [v.id, v]));
      },
      contractMap() {
        return new Map(this.contracts.map((c) => [c.id, c]));
      },
      bankMap() {
        return new Map(this.banks.map((b) => [b.id, b]));
      },
      processedCpcDataMap() {
        return new Map(this.processedCpcData.map((cpc) => [cpc.id, cpc]));
      },
      cogsContractsAsOfDate() {
        const asOfDate = this.viewStates.cogsDashboard.filter.asOfDate;
        const reportTime = asOfDate ? new Date(asOfDate).getTime() : Infinity;

        // Bước 1: Lọc nhanh các Hợp đồng thuộc các Dự án đang chọn (nếu có lọc)
        const selectedProjectIds = this.viewStates.cogsDashboard.filter.projectId;
        const targetContracts = selectedProjectIds.length > 0
          ? this.contracts.filter(c => selectedProjectIds.includes(c.projectId))
          : this.contracts;

        // Bước 2: Nhóm cpcDetailRows theo contractId TRƯỚC khi vào vòng lặp (Chỉ quét mảng Rows 1 lần)
        const rowsByContract = new Map();
        this.cpcDetailRows.forEach(row => {
          // Chỉ lấy các dòng có ngày hạch toán <= ngày báo cáo
          const postingTime = row.invoicePostingDate ? new Date(row.invoicePostingDate).getTime() : 0;
          if (postingTime <= reportTime) {
            if (!rowsByContract.has(row.contractId)) rowsByContract.set(row.contractId, []);
            rowsByContract.get(row.contractId).push(row);
          }
        });

        // Bước 3: Lấy Map CPC Items để tra cứu tỷ giá nhanh
        const cpcMap = new Map();
        this.cpcItems.forEach(c => {
          cpcMap.set(`${c.contractId}_${c.cpcIdentifier}`, c.exchangeRate || 0);
        });

        // Bước 4: Tính toán tổng hợp cho từng hợp đồng
        return targetContracts.map((contract) => {
          const project = this.projectMap.get(contract.projectId) || {};
          const vendor = this.vendorMap.get(contract.vendorId) || {};
          const relevantRows = rowsByContract.get(contract.id) || [];

          let invoiceAmountTotal = 0;
          const isUsd = contract.currency === "USD";

          relevantRows.forEach((row) => {
            if (isUsd) {
              // Ưu tiên tỷ giá trên hóa đơn, nếu ko có lấy tỷ giá CPC tương ứng
              let rate = parseFloat(row.invoiceExchangeRate) || cpcMap.get(`${contract.id}_${row.cpcNo}`) || 0;
              invoiceAmountTotal += Math.round((row.invoiceAmount || 0) * rate);
            } else {
              invoiceAmountTotal += (row.invoiceAmount || 0);
            }
          });

          return {
            ...contract,
            projectName: project.name || "N/A",
            vendorName: vendor.name || "N/A",
            vendorNo: vendor.vendorNo || "",
            invoiceAmountTotal,
          };
        });
      },
      hasOrphanData() {
        return Object.values(this.orphanData).some((arr) => arr.length > 0);
      },
      availableProjectsForBackup() {
        return [...this.projects].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      },
      availableCogsProjects() {
        const search = (
          this.viewStates.cogsDashboard.filter.projectSearch || ""
        ).toLowerCase();

        const projectIdsInUse = [
          ...new Set(this.contracts.map((c) => c.projectId)),
        ];

        const activeProjects = this.projects.filter((p) =>
          projectIdsInUse.includes(p.id)
        );

        if (!search) {
          return activeProjects.sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        }
        return activeProjects
          .filter((p) => p.name.toLowerCase().includes(search))
          .sort((a, b) => a.name.localeCompare(b.name));
      },

      availableCogsStatuses() {
        return ["Match", "Mismatch", "Only in App", "Only in Accounting"];
      },

      cogsDashboardData() {
        if (this.currentTab !== "cogs-dashboard") return [];

        const state = this.viewStates.cogsDashboard;
        const baseData = this.cogsContractsAsOfDate; // Dữ liệu này đã được lọc theo Project ở bước trên

        let finalData;
        if (!this.cogsComparisonData) {
          // Chế độ không có file SAP
          finalData = baseData.map(item => ({
            ...item,
            invAmountSap: 0,
            difference: item.invoiceAmountTotal,
            status: "Only in App",
          }));
        } else {
          // Chế độ đối chiếu với file SAP (Sử dụng Map để merge dữ liệu O(1))
          const sapData = this.cogsComparisonData;
          const allKeys = new Set([...baseData.map(c => c.contractSystemNo || c.contractNo), ...Object.keys(sapData)]);

          const appDataMap = new Map(baseData.map(c => [c.contractSystemNo || c.contractNo, c]));

          finalData = Array.from(allKeys).map(key => {
            const app = appDataMap.get(key);
            const excel = sapData[key];

            const invAmountApp = app ? app.invoiceAmountTotal : 0;
            const invAmountSap = excel ? excel.invAmount : 0;
            const diff = invAmountApp - invAmountSap;

            let status = "Mismatch";
            if (!app && excel) status = "Only in Accounting";
            else if (app && !excel) status = "Only in App";
            else if (Math.abs(diff) < 1) status = "Match";

            return {
              id: app ? app.id : key,
              glAccount: app ? app.glAccount : (excel?.glAccount || "N/A"),
              vendorName: app ? app.vendorName : (excel?.vendorName || "N/A"),
              contractNo: app ? app.contractNo : key,
              contractSystemNo: app ? app.contractSystemNo : key,
              projectId: app ? app.projectId : null,
              invoiceAmountTotal: invAmountApp,
              invAmountSap: invAmountSap,
              difference: diff,
              status: status,
            };
          });
        }

        // Lọc theo Status (nếu có chọn)
        if (state.filter.status.length > 0) {
          finalData = finalData.filter(item => state.filter.status.includes(item.status));
        }

        // Sắp xếp (Sort)
        if (state.sortBy) {
          const dir = state.sortDirection === "asc" ? 1 : -1;
          const key = state.sortBy;
          finalData.sort((a, b) => {
            const valA = a[key];
            const valB = b[key];
            if (typeof valA === 'number') return dir * (valA - valB);
            return dir * String(valA).localeCompare(String(valB));
          });
        }

        return finalData;
      },
      cogsSummaryData() {
        if (
          this.currentTab !== "cogs-dashboard" ||
          this.viewStates.cogsDashboard.filter.projectId.length === 0
        ) {
          return [];
        }
        const state = this.viewStates.cogsDashboard;

        const appSummary = new Map();

        const filteredContractsInApp = this.cogsContractsAsOfDate.filter(
          (c) => {
            const projectFilter = state.filter.projectId;
            return (
              projectFilter.length === 0 ||
              projectFilter.includes(c.projectId)
            );
          }
        );

        filteredContractsInApp.forEach((contract) => {
          const gl = contract.glAccount || "N/A";
          const currentTotal = appSummary.get(gl) || 0;
          appSummary.set(
            gl,
            currentTotal + (contract.invoiceAmountTotal || 0)
          );
        });

        if (!this.cogsSummaryFromSap) {
          return Array.from(appSummary.entries())
            .map(([gl, total]) => ({
              glAccount: gl,
              totalInvoiceAmount: total,
              totalSap: 0,
              difference: total,
            }))
            .sort((a, b) => a.glAccount.localeCompare(b.glAccount));
        }

        const sapSummary = this.cogsSummaryFromSap;
        const combinedKeys = new Set([
          ...appSummary.keys(),
          ...Object.keys(sapSummary),
        ]);
        const combinedData = [];

        combinedKeys.forEach((glAccount) => {
          const appAmount = appSummary.get(glAccount) || 0;
          const sapAmount = sapSummary[glAccount] || 0;
          combinedData.push({
            glAccount: glAccount,
            totalInvoiceAmount: appAmount,
            totalSap: sapAmount,
            difference: appAmount - sapAmount,
          });
        });

        return combinedData.sort((a, b) =>
          a.glAccount.localeCompare(b.glAccount)
        );
      },

      totalCogsSummary() {
        return this.cogsSummaryData.reduce(
          (totals, item) => {
            totals.totalInvoiceAmount += item.totalInvoiceAmount || 0;
            totals.totalSap += item.totalSap || 0;
            totals.difference += item.difference || 0;
            return totals;
          },
          { totalInvoiceAmount: 0, totalSap: 0, difference: 0 }
        );
      },

      paginatedCogsDetailsData() {
        const state = this.viewStates.cogsDashboard;
        const start = (state.currentPage - 1) * state.perPage;
        return this.cogsDashboardData.slice(start, start + state.perPage);
      },

      cogsDashboardTotalPages() {
        return Math.ceil(
          this.cogsDashboardData.length /
          this.viewStates.cogsDashboard.perPage
        );
      },

      totalCogsDetails() {
        return this.cogsDashboardData.reduce(
          (totals, item) => {
            totals.totalInvoiceAmount += item.invoiceAmountTotal || 0;
            if (this.cogsComparisonData) {
              totals.totalInvAmountSap += item.invAmountSap || 0;
              totals.totalDifference += item.difference || 0;
            }
            return totals;
          },
          {
            totalInvoiceAmount: 0,
            totalInvAmountSap: 0,
            totalDifference: 0,
          }
        );
      },

      sidebarTabs() {
        const tabs = [
          { key: "cpc-tracking", label: this.t("tabCpcTracking") },
          { key: "cpc-details", label: this.t("tabCpcDetails") },
          { key: "contract-overview", label: this.t("contractOverview") },
          { key: "vendor-partner", label: this.t("vendorPartner") },
          { key: "vendor-balance", label: this.t("tabVendorBalance") },
          { key: "cpc-dashboard", label: this.t("tabPaymentDashboard") },
          { key: "cpc-swap-dashboard", label: this.t("tabSwapDashboard") },
          { key: "cpc-bond-dashboard", label: this.t("tabBondDashboard") },
          {
            key: "cpc-contract-dashboard",
            label: this.t("tabContractDashboard"),
          },
          {
            key: "cpc-report-dashboard",
            label: this.t("tabReportDashboard"),
          },
          { key: "cogs-dashboard", label: this.t("tabCogsDashboard") },
          { key: "invoice-aging", label: this.t("tabInvoiceAging") },

          { key: "master-data", label: "Master Data" },
        ];
        if (this.isAdminUser) {
          tabs.push({ key: "admin-access", label: "Admin Access" });
        }
        return tabs;
      },
      quickMenuItems() {
        return [
          {
            action: "addCpc",
            label: this.t("btnAddCpc"),
            icon: "fas fa-plus",
          },
          {
            action: "addBond",
            label: this.t("btnAddBond"),
            icon: "fas fa-shield-alt",
          },
          {
            action: "addContract",
            label: this.t("btnAddContract"),
            icon: "fas fa-file-signature",
          },
          {
            action: "addVendor",
            label: this.t("modalTitleAddVendor", { vendor: "Vendor" }),
            icon: "fas fa-truck-fast",
          },
        ];
      },
      vendorBalanceData() {
        const _version = this.dataVersion;
        if (this.viewStates.vendorBalance.filter.projectId.length === 0) {
          return [];
        }

        const userSelectedDate =
          this.viewStates.vendorBalance.filter.asOfDate;
        const calculationDate = userSelectedDate
          ? userSelectedDate
          : appUtils.format.date(new Date());
        const reportDate = new Date(calculationDate);
        reportDate.setHours(23, 59, 59, 999);

        const projectFilter =
          this.viewStates.vendorBalance.filter.projectId;

        let relevantContracts = this.contracts.filter((c) =>
          projectFilter.includes(c.projectId)
        );

        const vendorMap = new Map();

        relevantContracts.forEach((contract) => {
          const vendor = this.vendorMap.get(contract.vendorId);
          if (!vendor) return;

          if (!vendorMap.has(vendor.id)) {
            vendorMap.set(vendor.id, {
              vendorId: vendor.id,
              vendorNo: vendor.vendorNo,
              vendorName: vendor.name,
              gl3311: 0,
              gl3312: 0,
            });
          }

          const vendorData = vendorMap.get(vendor.id);
          let finalPayableInVND = 0;
          let finalAdvanceInVND = 0;

          if (contract.currency === "USD") {
            const detailsTable =
              this.cpcDetailRowsByContractId.get(contract.id) || [];
            const cpcItemsForContract =
              this.cpcItemsByContractId.get(contract.id) || [];
            const allCpcIdsForContract = cpcItemsForContract.map(
              (cpc) => cpc.id
            );

            const getEffectiveRateForRow = (row) => {
              let rate = parseFloat(row.invoiceExchangeRate) || 0;
              if (rate > 0) return rate;

              const cpcItem = cpcItemsForContract.find(
                (cpc) => cpc.cpcIdentifier === row.cpcNo
              );
              return cpcItem ? cpcItem.exchangeRate || 0 : 0;
            };

            let totalAdvanceVND = 0;
            let totalRepaymentVND = 0;

            detailsTable.forEach((row) => {
              const rate = getEffectiveRateForRow(row);
              const cpcItem = cpcItemsForContract.find(
                (c) => c.cpcIdentifier === row.cpcNo
              );
              if (cpcItem) {
                const installmentsForCpc =
                  this.installmentsByCpcId.get(cpcItem.id) || [];
                const isAdvancePaid = installmentsForCpc.some(
                  (inst) => inst.date && new Date(inst.date) <= reportDate
                );
                if (isAdvancePaid) {
                  totalAdvanceVND += Math.round(
                    (row.cpcAdvance || 0) * rate
                  );
                }
              }
              if (
                row.invoicePostingDate &&
                new Date(row.invoicePostingDate) <= reportDate
              ) {
                totalRepaymentVND += Math.round(
                  (row.cpcRepayment || 0) * rate
                );
              }
            });

            finalAdvanceInVND = totalAdvanceVND + totalRepaymentVND;

            const totalInvoicedVND = detailsTable
              .filter(
                (row) =>
                  row.invoicePostingDate &&
                  new Date(row.invoicePostingDate) <= reportDate
              )
              .reduce(
                (sum, row) =>
                  sum +
                  Math.round(
                    (row.invoiceTotal || 0) * getEffectiveRateForRow(row)
                  ),
                0
              );

            const totalPaidVND = allCpcIdsForContract.reduce(
              (sum, cpcId) => {
                const installmentsForCpc =
                  this.installmentsByCpcId.get(cpcId) || [];
                const paidForCpc = installmentsForCpc
                  .filter(
                    (inst) => inst.date && new Date(inst.date) <= reportDate
                  )
                  .reduce(
                    (cpcSum, inst) =>
                      cpcSum + (inst.amountVND || inst.amount || 0),
                    0
                  );
                return sum + paidForCpc;
              },
              0
            );

            const payableFromInvoice = totalInvoicedVND - totalPaidVND;
            const finalPayableRaw = payableFromInvoice + finalAdvanceInVND;
            finalPayableInVND = Math.max(0, finalPayableRaw);
          } else {
            const balance = this.calculateContractBalanceAsOf(
              contract.id,
              calculationDate
            );
            finalPayableInVND = balance.finalPayable;
            finalAdvanceInVND = balance.advanceBalance;
          }

          vendorData.gl3311 += finalPayableInVND;
          vendorData.gl3312 += finalAdvanceInVND;
        });

        let data = Array.from(vendorMap.values());
        const state = this.viewStates.vendorBalance;
        if (state.sortBy) {
          data.sort((a, b) => {
            let valA = a[state.sortBy];
            let valB = b[state.sortBy];
            if (typeof valA === "string") {
              return state.sortDirection === "asc"
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
            } else {
              return state.sortDirection === "asc"
                ? valA - valB
                : valB - valA;
            }
          });
        }
        return data;
      },
      paginatedVendorBalanceData() {
        const state = this.viewStates.vendorBalance;
        const start = (state.currentPage - 1) * state.perPage;
        const end = start + state.perPage;
        return this.vendorBalanceData.slice(start, end);
      },
      vendorBalanceTotalPages() {
        const totalItems = this.accountingComparisonData
          ? this.vendorBalanceComparison.length
          : this.vendorBalanceData.length;
        return Math.ceil(
          totalItems / this.viewStates.vendorBalance.perPage
        );
      },
      totalVendorBalance() {
        return this.vendorBalanceData.reduce(
          (totals, item) => {
            totals.gl3311 += item.gl3311;
            totals.gl3312 += item.gl3212;
            return totals;
          },
          { gl3311: 0, gl3312: 0 }
        );
      },
      availableProjectsForVendorBalance() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.projects,
          linkingData: this.contracts,
          linkKey: "projectId",
          searchTerm: this.viewStates.vendorBalance.filter.projectSearch,
          vueInstance: this,
        });
      },

      vendorBalanceComparison() {
        let dataToFilterAndSort;

        if (!this.accountingComparisonData) {
          dataToFilterAndSort = this.vendorBalanceData.map((item) => ({
            ...item,
            gl3311_app: item.gl3311,
            gl3312_app: item.gl3312,
            status: "",
          }));
        } else {
          const comparison = [];
          const allVendorNos = new Set([
            ...this.vendorBalanceData.map((v) => v.vendorNo),
            ...Object.keys(this.accountingComparisonData),
          ]);
          allVendorNos.forEach((vendorNo) => {
            if (!vendorNo) return;
            const appData = this.vendorBalanceData.find(
              (v) => v.vendorNo === vendorNo
            );
            const excelData = this.accountingComparisonData[vendorNo];
            const gl3311_app = appData ? appData.gl3311 : 0;
            const gl3312_app = appData ? appData.gl3312 : 0;
            const gl3311_excel = excelData ? excelData.gl3311 : 0;
            const gl3312_excel = excelData ? excelData.gl3312 : 0;
            const gl3311_diff = gl3311_app - gl3311_excel;
            const gl3312_diff = gl3312_app - gl3312_excel;

            let status = "Mismatch";
            if (!appData && excelData) status = "Only in Accounting";
            else if (appData && !excelData) status = "Only in App";
            else if (
              Math.round(gl3311_diff) === 0 &&
              Math.round(gl3312_diff) === 0
            )
              status = "Match";

            comparison.push({
              vendorId: appData ? appData.vendorId : vendorNo,
              vendorNo: vendorNo,
              vendorName: appData
                ? appData.vendorName
                : excelData.vendorName || `(Chưa có trong App)`,
              gl3311_app,
              gl3312_app,
              gl3311_excel,
              gl3312_excel,
              gl3311_diff,
              gl3312_diff,
              status,
            });
          });
          dataToFilterAndSort = comparison;
        }

        const filters = this.viewStates.vendorBalance.filter;
        const searchTerm = this.viewStates.vendorBalance.searchTerm;

        if (filters.status.length > 0) {
          dataToFilterAndSort = dataToFilterAndSort.filter((item) =>
            filters.status.includes(item.status)
          );
        }

        if (filters.balanceStatus === "hasBalance") {
          dataToFilterAndSort = dataToFilterAndSort.filter((item) => {
            if (this.accountingComparisonData) {
              return (
                (item.gl3311_app || 0) !== 0 ||
                (item.gl3312_app || 0) !== 0 ||
                (item.gl3311_excel || 0) !== 0 ||
                (item.gl3312_excel || 0) !== 0
              );
            } else {
              return (
                (item.gl3311_app || 0) !== 0 || (item.gl3312_app || 0) !== 0
              );
            }
          });
        } else if (filters.balanceStatus === "fullySettled") {
          dataToFilterAndSort = dataToFilterAndSort.filter((item) => {
            if (this.accountingComparisonData) {
              return (
                (item.gl3311_app || 0) === 0 &&
                (item.gl3312_app || 0) === 0 &&
                (item.gl3311_excel || 0) === 0 &&
                (item.gl3312_excel || 0) === 0
              );
            } else {
              return (
                (item.gl3311_app || 0) === 0 && (item.gl3312_app || 0) === 0
              );
            }
          });
        }

        if (searchTerm && searchTerm.trim() !== "") {
          const normalizedSearch = appUtils.text.normalizeVietnamese(
            searchTerm.trim()
          );
          const rawSearch = searchTerm.trim().toLowerCase();

          dataToFilterAndSort = dataToFilterAndSort.filter((item) => {
            const normName = appUtils.text.normalizeVietnamese(
              item.vendorName || ""
            );
            const normNo = (item.vendorNo || "").toLowerCase();
            return (
              normName.includes(normalizedSearch) ||
              normNo.includes(rawSearch)
            );
          });
        }

        const state = this.viewStates.vendorBalance;
        if (state.sortBy) {
          dataToFilterAndSort.sort((a, b) => {
            let valA = a[state.sortBy];
            let valB = b[state.sortBy];
            const sortKey =
              state.sortBy.endsWith("_app") ||
                state.sortBy.endsWith("_excel") ||
                state.sortBy.endsWith("_diff")
                ? state.sortBy
                : `${state.sortBy}_app`;

            if (a[sortKey] !== undefined) valA = a[sortKey];
            else if (a[state.sortBy] !== undefined) valA = a[state.sortBy];

            if (b[sortKey] !== undefined) valB = b[sortKey];
            else if (b[state.sortBy] !== undefined) valB = b[state.sortBy];

            if (typeof valA === "string") {
              return state.sortDirection === "asc"
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
            } else {
              return state.sortDirection === "asc"
                ? (valA || 0) - (valB || 0)
                : (valB || 0) - (valA || 0);
            }
          });
        }

        return dataToFilterAndSort;
      },

      paginatedVendorBalanceComparison() {
        const state = this.viewStates.vendorBalance;
        const start = (state.currentPage - 1) * state.perPage;
        const end = start + state.perPage;
        return this.vendorBalanceComparison.slice(start, end);
      },

      totalVendorBalanceComparison() {
        return this.vendorBalanceComparison.reduce(
          (totals, item) => {
            totals.gl3311_app += item.gl3311_app || 0;
            totals.gl3312_app += item.gl3312_app || 0;
            totals.gl3311_excel += item.gl3311_excel || 0;
            totals.gl3312_excel += item.gl3312_excel || 0;
            totals.gl3311_diff += item.gl3311_diff || 0;
            totals.gl3312_diff += item.gl3312_diff || 0;
            return totals;
          },
          {
            gl3311_app: 0,
            gl3312_app: 0,
            gl3311_excel: 0,
            gl3312_excel: 0,
            gl3311_diff: 0,
            gl3312_diff: 0,
          }
        );
      },

      invoiceCpcRows() {
        if (!this.currentDetailItem || !this.currentDetailItem.cpcNo)
          return [];
        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        return this.cpcDetailRows.filter(
          (row) =>
            row.contractId === contractId &&
            row.cpcNo === this.currentDetailItem.cpcNo
        );
      },
      vendorUsageCount() {
        const counts = {};
        this.vendors.forEach((v) => (counts[v.id] = 0));
        this.contracts.forEach((c) => {
          if (counts[c.vendorId] !== undefined) {
            counts[c.vendorId]++;
          }
        });
        return counts;
      },

      projectUsageCount() {
        const counts = {};
        this.projects.forEach((p) => (counts[p.id] = 0));
        this.contracts.forEach((c) => {
          if (counts[c.projectId] !== undefined) {
            counts[c.projectId]++;
          }
        });
        return counts;
      },

      bankUsageCount() {
        const counts = {};
        this.banks.forEach((b) => (counts[b.id] = 0));
        this.bonds.forEach((bond) => {
          if (counts[bond.issuingBank] !== undefined) {
            counts[bond.issuingBank]++;
          }
        });
        return counts;
      },

      filteredVendorsForAdmin() {
        const state = this.masterData.vendors;
        if (!state.searchTerm) {
          return this.vendors;
        }
        const normalizedSearch = appUtils.text.normalizeVietnamese(
          state.searchTerm
        );
        return this.vendors.filter(
          (v) =>
            appUtils.text
              .normalizeVietnamese(v.name)
              .includes(normalizedSearch) ||
            (v.abbrName &&
              appUtils.text
                .normalizeVietnamese(v.abbrName)
                .includes(normalizedSearch)) ||
            (v.vendorNo && v.vendorNo.includes(state.searchTerm))
        );
      },
      paginatedVendors() {
        const state = this.masterData.vendors;
        const start = (state.currentPage - 1) * state.perPage;
        return this.filteredVendorsForAdmin.slice(
          start,
          start + state.perPage
        );
      },
      vendorTotalPages() {
        return Math.ceil(
          this.filteredVendorsForAdmin.length /
          this.masterData.vendors.perPage
        );
      },

      filteredProjectsForAdmin() {
        const state = this.masterData.projects;
        if (!state.searchTerm) return this.projects;
        const normalizedSearch = appUtils.text.normalizeVietnamese(
          state.searchTerm
        );
        return this.projects.filter((p) =>
          appUtils.text
            .normalizeVietnamese(p.name)
            .includes(normalizedSearch)
        );
      },
      paginatedProjects() {
        const state = this.masterData.projects;
        const start = (state.currentPage - 1) * state.perPage;
        return this.filteredProjectsForAdmin.slice(
          start,
          start + state.perPage
        );
      },
      projectTotalPages() {
        return Math.ceil(
          this.filteredProjectsForAdmin.length /
          this.masterData.projects.perPage
        );
      },

      formattedLastSaveTime() {
        if (!this.lastSaveTimestamp) {
          return null;
        }
        const date = new Date(this.lastSaveTimestamp);
        return date.toLocaleString(this.language, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      },
      tooltipText() {
        if (this.isDataDirty) {
          return this.t("unsavedChangesTooltip");
        }
        if (this.formattedLastSaveTime) {
          return `${this.t("savedStatusTooltip")} - ${this.formattedLastSaveTime
            }`;
        }
        return this.t("savedStatusTooltip");
      },
      commandResults() {
        if (!this.commandSearchTerm) {
          return [];
        }
        return this.commandSearchResults;
      },

      availableRepaymentBasis() {
        if (!this.currentDetailItem) return [];
        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        const tableData = this.cpcDetailRows
          .filter((r) => r.contractId === contractId)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        return tableData
          .map((row, index) => {
            const cVal = Number(row.contractAmount) || 0;
            const vVal = Number(row.contractVon) || 0;
            if (cVal === 0 && vVal === 0) return null;

            return {
              id: row.id,
              index: index + 1,
              info: row.contractInfo || "Hợp đồng chính",
              contractAmount: cVal,
              contractVon: vVal,
              total: cVal + vVal,
              isChecked:
                this.currentDetailItem.repaymentBasisItems?.includes(
                  row.id
                ) || false,
            };
          })
          .filter(Boolean);
      },

      isCurrentContractUSD() {
        return this.selectedContractDetails?.currency === "USD";
      },
      vndViewWeightedAvgRate() {
        if (
          !this.isCurrentContractUSD ||
          this.viewStates.cpcDetails.currencyView !== "VND"
        ) {
          return 0;
        }
        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        if (!contractId) return 0;

        const cpcIdsForContract = this.cpcItems
          .filter((c) => c.contractId === contractId)
          .map((c) => c.id);
        const allPayments = this.installments.filter((i) =>
          cpcIdsForContract.includes(i.cpcId)
        );

        const totalPaidUSD = allPayments.reduce(
          (sum, p) => sum + (p.amountUsd || 0),
          0
        );
        const totalPaidVND = allPayments.reduce(
          (sum, p) => sum + (p.amountVND || p.amount || 0),
          0
        );

        return totalPaidUSD > 0 ? totalPaidVND / totalPaidUSD : 0;
      },
      displayedContractDetailTable() {
        const _version = this.dataVersion;
        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        if (!contractId) return [];

        const activePhaseId = this.viewStates.cpcDetails.activePhaseId;
        const contractPhases = this.selectedContractDetails?.phases || [];

        let allRows = this.cpcDetailRows.filter(
          (row) => row.contractId === contractId
        );
        let rowsToDisplay = [];

        if (activePhaseId === "summary") {
          const rowsByPhase = {};
          contractPhases.forEach((p) => (rowsByPhase[p.id] = []));
          rowsByPhase["undefined"] = [];

          allRows.forEach((row) => {
            const pId =
              row.phaseId &&
                contractPhases.some((p) => p.id === row.phaseId)
                ? row.phaseId
                : "undefined";
            rowsByPhase[pId].push(row);
          });

          contractPhases.forEach((phase) => {
            const phaseRows = rowsByPhase[phase.id].sort(
              (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
            );

            const displayRows = phaseRows.map((r, index) => {
              const rView = { ...r };
              if (index === 0) {
                const phasePrefix = `[${phase.name}]`;
                if (
                  !rView.contractInfo ||
                  !rView.contractInfo.startsWith("[")
                ) {
                  rView.contractInfo = `${phasePrefix}\n${rView.contractInfo || ""
                    }`;
                }
              }
              return rView;
            });

            rowsToDisplay.push(...displayRows);
          });

          const undefinedRows = rowsByPhase["undefined"].sort(
            (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
          );
          if (contractPhases.length > 0) {
            const nonEmptyUndefinedRows = undefinedRows.filter(
              (r) =>
                (r.contractAmount || 0) !== 0 ||
                (r.contractVon || 0) !== 0 ||
                r.cpcNo
            );

            if (nonEmptyUndefinedRows.length > 0) {
              const firstUnset = { ...nonEmptyUndefinedRows[0] };
              firstUnset.contractInfo = `[Chung/Khác]\n${firstUnset.contractInfo || ""
                }`;
              nonEmptyUndefinedRows[0] = firstUnset;
              rowsToDisplay.push(...nonEmptyUndefinedRows);
            }
          } else {
            rowsToDisplay.push(...undefinedRows);
          }
        } else {
          rowsToDisplay = allRows
            .filter((row) => row.phaseId === activePhaseId)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        }

        if (
          this.isCurrentContractUSD &&
          this.viewStates.cpcDetails.currencyView === "VND"
        ) {
          return rowsToDisplay.map((item) => {
            const newItem = { ...item };
            let effectiveRate = parseFloat(item.invoiceExchangeRate) || 0;
            if (effectiveRate <= 0 && item.cpcNo) {
              const cpcItem = this.cpcItems.find(
                (c) =>
                  c.contractId === contractId &&
                  c.cpcIdentifier === item.cpcNo
              );
              if (cpcItem) effectiveRate = cpcItem.exchangeRate || 0;
            }
            const fieldsToConvert = [
              "contractAmount",
              "contractVon",
              "cpcWorkDone",
              "cpcPaymentOfWorkdone",
              "cpcAdvance",
              "cpcRepayment",
              "cpcRetention",
              "cpcOtherDeduction",
              "cpcAmountDue",
              "invoiceAmount",
              "paymentTotalAmount",
              "paymentGrandTotal",
              "remainingPayable",
              "contractRemainingInclVat",
              "contractRemainingExclVat",
            ];
            fieldsToConvert.forEach(
              (f) =>
                (newItem[f] = Math.round((item[f] || 0) * effectiveRate))
            );
            newItem.contractVat = 0;
            newItem.contractTotal =
              newItem.contractAmount + newItem.contractVon;
            newItem.invoiceVat = 0;
            newItem.invoiceTotal = newItem.invoiceAmount;
            newItem.paymentTotalVat = 0;
            newItem.contractRemainingVat = 0;
            newItem.paymentInstallments = (
              item.paymentInstallments || []
            ).map((p) => ({
              ...p,
              amount: Math.round(
                (p.amountUsd || 0) * (p.exchangeRate || effectiveRate)
              ),
              vat: 0,
              totalVND: Math.round(
                (p.amountUsd || 0) * (p.exchangeRate || effectiveRate)
              ),
            }));
            return newItem;
          });
        }

        return rowsToDisplay;
      },
      availableReportProjects() {
        const search = (
          this.viewStates.reportDashboard.filter.projectSearch || ""
        ).toLowerCase();
        const projectIdsInUse = [
          ...new Set(this.contracts.map((c) => c.projectId)),
        ];
        const activeProjects = this.projects.filter((p) =>
          projectIdsInUse.includes(p.id)
        );

        if (!search) {
          return activeProjects.sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        }

        return activeProjects
          .filter((p) => p.name.toLowerCase().includes(search))
          .sort((a, b) => a.name.localeCompare(b.name));
      },
      formattedAsOfDate() {
        if (!this.viewStates.reportDashboard.asOfDate) return "";
        const [year, month, day] =
          this.viewStates.reportDashboard.asOfDate.split("-");
        return `${day}/${month}/${year}`;
      },
      formattedReportMonth() {
        if (!this.viewStates.reportDashboard.reportMonth) return "";
        const [year, month] =
          this.viewStates.reportDashboard.reportMonth.split("-");
        return `${month}/${year}`;
      },
      reportData() {
        if (this.currentTab !== "cpc-report-dashboard" || this.viewStates.reportDashboard.filter.projectId.length === 0) {
          return [];
        }

        const emptyMetrics = () => ({
          paidToDate: { net: 0, vat: 0, total: 0 },
          remaining: { net: 0, vat: 0, total: 0 },
          paidInMonth: { net: 0, vat: 0, total: 0 },
        });

        const flatReport = [];
        if (this.reportCategoriesFromDB.length > 0) {
          const parentItems = this.reportCategoriesFromDB
            .filter((c) => c.level === 1)
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

          parentItems.forEach((parent) => {
            flatReport.push({
              ...parent,
              name: this.language === "vi" ? parent.name_vi : parent.name_en,
              metrics: emptyMetrics(),
            });
            const children = this.reportCategoriesFromDB
              .filter((c) => c.parentCode === parent.code)
              .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

            children.forEach((child) => {
              flatReport.push({
                ...child,
                name: this.language === "vi" ? child.name_vi : child.name_en,
                metrics: emptyMetrics(),
              });
            });
          });
        }

        const reportMap = new Map(flatReport.map((item) => [item.code, item]));
        const [reportYear, reportMonth] = this.viewStates.reportDashboard.reportMonth.split("-").map(Number);
        const asOfDate = this.viewStates.reportDashboard.asOfDate;
        const reportDate = new Date(asOfDate);
        reportDate.setHours(23, 59, 59, 999);

        const filteredContracts = this.contracts.filter((c) => {
          const projectFilter = this.viewStates.reportDashboard.filter.projectId;
          return projectFilter.length === 0 || projectFilter.includes(c.projectId);
        });

        // --- PHẦN 1: GIỮ NGUYÊN LOGIC GỐC CHO PAID TO DATE & REMAINING ---
        filteredContracts.forEach((contract) => {
          if (!contract.code) return;
          const reportItem = reportMap.get(String(contract.code));
          if (!reportItem) return;

          const cpcItemsForContract = this.cpcItemsByContractId.get(contract.id) || [];
          const cpcIdsForContract = cpcItemsForContract.map((c) => c.id);
          const allInstallmentsForContract = cpcIdsForContract.flatMap(
            (cpcId) => this.installmentsByCpcId.get(cpcId) || []
          );

          const relevantInstallmentsAsOfDate = allInstallmentsForContract.filter(
            (inst) => !inst.isSwap && inst.date && new Date(inst.date) <= reportDate
          );

          const paidAmountInclVAT_asOfDate = relevantInstallmentsAsOfDate.reduce(
            (sum, inst) => sum + (inst.amountVND || inst.amount || 0), 0
          );

          let paidAmountExclVAT_asOfDate = 0;
          if (contract.currency === "USD") {
            paidAmountExclVAT_asOfDate = paidAmountInclVAT_asOfDate;
          } else {
            cpcItemsForContract.forEach((cpc) => {
              const cpcInsts = relevantInstallmentsAsOfDate.filter((i) => i.cpcId === cpc.id);
              const totalPaidForCpc = cpcInsts.reduce((sum, i) => sum + i.amount, 0);
              if (cpc.amount > 0) {
                const ratio = totalPaidForCpc / cpc.amount;
                paidAmountExclVAT_asOfDate += (cpc.amountExclVAT || 0) * ratio;
              } else {
                paidAmountExclVAT_asOfDate += totalPaidForCpc;
              }
            });
          }
          const paidVatAmount_asOfDate = paidAmountInclVAT_asOfDate - paidAmountExclVAT_asOfDate;

          reportItem.metrics.paidToDate.net += paidAmountExclVAT_asOfDate;
          reportItem.metrics.paidToDate.vat += paidVatAmount_asOfDate;
          reportItem.metrics.paidToDate.total += paidAmountInclVAT_asOfDate;

          const detailsTable = this.cpcDetailRowsByContractId.get(contract.id) || [];
          let remainingNet = 0;
          let remainingVat = 0;

          if (contract.currency === "USD") {
            const totalContractValueUSD = detailsTable.reduce((sum, row) => sum + (row.contractAmount || 0) + (row.contractVon || 0), 0);
            const totalPaidUSD_asOfDate = relevantInstallmentsAsOfDate.reduce((sum, p) => sum + (p.amountUsd || 0), 0);
            const remainingUSD = Math.max(0, totalContractValueUSD - totalPaidUSD_asOfDate);
            const weightedAvgRate = totalPaidUSD_asOfDate > 0 ? (paidAmountInclVAT_asOfDate / totalPaidUSD_asOfDate) : 25400;
            remainingNet = Math.round(remainingUSD * weightedAvgRate);
          } else {
            const contractAmountTotal = detailsTable.reduce((sum, row) => sum + (row.contractAmount || 0) + (row.contractVon || 0), 0);
            const contractVatTotal = detailsTable.reduce((sum, row) => sum + (row.contractVat || 0), 0);
            remainingNet = contractAmountTotal - paidAmountExclVAT_asOfDate;
            remainingVat = contractVatTotal - paidVatAmount_asOfDate;
          }

          reportItem.metrics.remaining.net += remainingNet;
          reportItem.metrics.remaining.vat += remainingVat;
          reportItem.metrics.remaining.total += (remainingNet + remainingVat);
        });

        // --- PHẦN 2: LOGIC ĐÃ SỬA CHO PAID IN MONTH (QUÉT TRỰC TIẾP TỪ INSTALLMENTS) ---
        const projectFilter = this.viewStates.reportDashboard.filter.projectId;
        this.installments.forEach((inst) => {
          if (inst.isSwap || !inst.date) return;
          const pDate = new Date(inst.date);
          if (pDate.getFullYear() === reportYear && (pDate.getMonth() + 1) === reportMonth) {
            if (projectFilter.length > 0 && !projectFilter.includes(inst.projectId)) return;

            const contract = this.contractMap.get(inst.contractId);
            if (!contract || !contract.code) return;

            const reportItem = reportMap.get(String(contract.code));
            if (!reportItem) return;

            const paymentAmountVND = inst.amountVND || inst.amount || 0;
            let pNet = 0;
            if (contract.currency === "USD") {
              pNet = paymentAmountVND;
            } else {
              const parentCpc = this.cpcItems.find(c => c.id === inst.cpcId);
              pNet = (parentCpc && parentCpc.amount !== 0)
                ? Math.round((parentCpc.amountExclVAT || 0) * (paymentAmountVND / parentCpc.amount))
                : Math.round(paymentAmountVND / 1.08);
            }
            reportItem.metrics.paidInMonth.net += pNet;
            reportItem.metrics.paidInMonth.vat += (paymentAmountVND - pNet);
            reportItem.metrics.paidInMonth.total += paymentAmountVND;
          }
        });

        // Tính tổng từ con lên cha
        for (let i = flatReport.length - 1; i >= 0; i--) {
          const item = flatReport[i];
          if (item.level > 1) {
            const parentCode = String(item.code).split(".")[0];
            const parent = reportMap.get(parentCode);
            if (parent) {
              Object.keys(item.metrics).forEach((mK) => {
                Object.keys(item.metrics[mK]).forEach((vK) => {
                  parent.metrics[mK][vK] += item.metrics[mK][vK];
                });
              });
            }
          }
        }
        return flatReport;
      },
      reportGrandTotal() {
        const totals = {
          paidToDate: { net: 0, vat: 0, total: 0 },
          remaining: { net: 0, vat: 0, total: 0 },
          paidInMonth: { net: 0, vat: 0, total: 0 },
        };
        this.reportData.forEach((item) => {
          if (item.level === 1) {
            Object.keys(totals).forEach((metricKey) => {
              totals[metricKey].net += item.metrics[metricKey].net;
              totals[metricKey].vat += item.metrics[metricKey].vat;
              totals[metricKey].total += item.metrics[metricKey].total;
            });
          }
        });
        return totals;
      },
      detailsAvailableColumnGroups() {
        return [
          { key: "contract", label: this.t("columnGroupContract") },
          { key: "cpc", label: this.t("columnGroupCpc") },
          { key: "payment", label: this.t("columnGroupPayment") },
          { key: "invoice", label: this.t("columnGroupInvoice") },
          {
            key: "remainingPayable",
            label: this.t("columnGroupRemainingPayable"),
          },
          {
            key: "contractRemaining",
            label: this.t("columnGroupContractRemaining"),
          },
        ];
      },
      detailsAllSubColumns() {
        return [
          {
            key: "contractInfo",
            label: this.t("contractinfo"),
            group: "contract",
          },
          {
            key: "description",
            label: this.t("details"),
            group: "contract",
          },
          {
            key: "contractAmount",
            label: `${this.t("contract")} - ${this.t("amount")}`,
            group: "contract",
          },
          {
            key: "contractVon",
            label: `${this.t("contract")} - Von`,
            group: "contract",
          },
          {
            key: "contractVat",
            label: `${this.t("contract")} - Vat`,
            group: "contract",
          },
          {
            key: "contractTotal",
            label: `${this.t("contract")} - Total`,
            group: "contract",
          },

          { key: "cpcNo", label: "CPC No", group: "cpc" },
          { key: "cpcDueDate", label: "Due Date", group: "cpc" },
          { key: "cpcWorkDone", label: "Work-done", group: "cpc" },
          {
            key: "cpcPaymentOfWorkdone",
            label: "Payment of workdone",
            group: "cpc",
          },
          { key: "cpcAdvance", label: "Advance", group: "cpc" },
          { key: "cpcRepayment", label: "Repayment", group: "cpc" },
          { key: "cpcRetention", label: "Retention", group: "cpc" },
          {
            key: "cpcOtherDeduction",
            label: "Other deduction",
            group: "cpc",
          },
          {
            key: "cpcAmountDue",
            label: `${this.t("amount")} Due - ${this.t("net")}`,
            group: "cpc",
          },
          {
            key: "cpcVatAmountDue",
            label: `${this.t("amount")} Due - Vat`,
            group: "cpc",
          },

          {
            key: "paymentDate",
            label: `${this.t("tabPaymentDashboard")} - ${this.t("date")}`,
            group: "payment",
          },
          {
            key: "paymentAmount",
            label: `${this.t("tabPaymentDashboard")} - ${this.t("net")}`,
            group: "payment",
          },
          {
            key: "paymentVat",
            label: `${this.t("tabPaymentDashboard")} - Vat`,
            group: "payment",
          },
          {
            key: "paymentTotal",
            label: `${this.t("tabPaymentDashboard")} - Total`,
            group: "payment",
          },

          { key: "invoiceNo", label: `Invoice - No.`, group: "invoice" },
          {
            key: "invoiceDate",
            label: `Invoice - ${this.t("date")}`,
            group: "invoice",
          },
          {
            key: "invoiceAmount",
            label: `Invoice - ${this.t("net")}`,
            group: "invoice",
          },
          { key: "invoiceVat", label: `Invoice - Vat`, group: "invoice" },
          {
            key: "invoiceTotal",
            label: `Invoice - Total`,
            group: "invoice",
          },

          {
            key: "contractRemainingInclVat",
            label: `${this.t("columnGroupContractRemaining")} - Incl. Vat`,
            group: "contractRemaining",
          },
          {
            key: "contractRemainingExclVat",
            label: `${this.t("columnGroupContractRemaining")} - Excl. Vat`,
            group: "contractRemaining",
          },
          {
            key: "contractRemainingVat",
            label: `${this.t("columnGroupContractRemaining")} - Vat`,
            group: "contractRemaining",
          },
        ];
      },
      paymentSubRowColspan() {
        let count = 0;
        if (this.viewStates.cpcDetails.columnVisibility.contract)
          count += this.getGroupColspan("contract");
        if (this.viewStates.cpcDetails.columnVisibility.cpc)
          count += this.getGroupColspan("cpc");
        return count;
      },
      paymentSubRowColspanAfter() {
        let count = 0;
        if (this.viewStates.cpcDetails.columnVisibility.invoice)
          count += this.getGroupColspan("invoice");
        if (this.viewStates.cpcDetails.columnVisibility.remainingPayable)
          count += 1;
        if (this.viewStates.cpcDetails.columnVisibility.contractRemaining)
          count += this.getGroupColspan("contractRemaining");
        return count;
      },
      availableDetailProjects() {
        const projectIdsInUse = new Set(
          this.contracts.map((c) => c.projectId)
        );
        const activeProjects = this.projects.filter((p) =>
          projectIdsInUse.has(p.id)
        );

        const search = (
          this.viewStates.cpcDetails.filter.projectSearch || ""
        ).toLowerCase();

        if (!search) {
          return activeProjects.sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        }
        return activeProjects
          .filter((p) => p.name.toLowerCase().includes(search))
          .sort((a, b) => a.name.localeCompare(b.name));
      },
      availableDetailVendors() {
        const projectIds = this.viewStates.cpcDetails.filter.projectId;
        if (projectIds.length === 0) return [];

        const relevantContracts = appUtils.filter.filterBySelectedIds(
          this.contracts,
          projectIds,
          "projectId"
        );

        return appUtils.filter.getAvailableItems({
          sourceData: this.vendors,
          linkingData: relevantContracts,
          linkKey: "vendorId",
          searchTerm: this.viewStates.cpcDetails.filter.vendorSearch,
          vueInstance: this,
        });
      },
      availableDetailContracts() {
        const projectIds = this.viewStates.cpcDetails.filter.projectId;
        const vendorIds = this.viewStates.cpcDetails.filter.vendorId;
        if (projectIds.length !== 1 || vendorIds.length !== 1) return [];

        return this.contracts
          .filter(
            (c) =>
              c.projectId === projectIds[0] && c.vendorId === vendorIds[0]
          )
          .sort((a, b) => a.contractNo.localeCompare(b.contractNo));
      },
      selectedContractDetails() {
        const selectedId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        if (!selectedId) {
          return null;
        }

        const contract = this.contractMap.get(selectedId);
        if (!contract) {
          console.warn(
            `Contract with ID ${selectedId} not found in contractMap.`
          );
          return null;
        }

        const project = this.projectMap.get(contract.projectId);
        if (!project) {
          console.warn(
            `Project with ID ${contract.projectId} for Contract ${contract.contractNo} not found.`
          );
          return null;
        }

        const vendor = this.vendorMap.get(contract.vendorId);
        if (!vendor) {
          console.warn(
            `Vendor with ID ${contract.vendorId} for Contract ${contract.contractNo} not found.`
          );
          return null;
        }

        return {
          ...contract,
          projectName: project.name,
          vendorName: vendor.name,
          vendorNameAbbr: vendor.abbrName || vendor.name,
          vendorNo: vendor.vendorNo || "",
          status: contract.status || "Active",
          statusNote: contract.statusNote || "",
        };
      },
      totalDetails() {
        const _version = this.dataVersion;
        const activeTable = this.displayedContractDetailTable || [];
        const numericFields = [
          "contractAmount",
          "contractVon",
          "contractVat",
          "contractTotal",
          "cpcWorkDone",
          "cpcPaymentOfWorkdone",
          "cpcAdvance",
          "cpcRepayment",
          "cpcRetention",
          "cpcOtherDeduction",
          "cpcAmountDue",
          "cpcVat",
          "paymentTotalAmount",
          "paymentTotalVat",
          "paymentGrandTotal",
          "invoiceAmount",
          "invoiceVat",
          "invoiceTotal",
          "remainingPayable",
          "contractRemainingInclVat",
          "contractRemainingExclVat",
          "contractRemainingVat",
        ];

        const totals = {};
        numericFields.forEach((field) => {
          totals[field] = activeTable.reduce(
            (sum, item) => sum + (Number(item[field]) || 0),
            0
          );
        });

        totals.paymentAmount = totals.paymentTotalAmount;
        totals.paymentVat = totals.paymentTotalVat;
        totals.paymentTotal = totals.paymentGrandTotal;

        return totals;
      },
      detailsCalculatedFooter() {
        const totals = this.totalDetails;
        if (!totals) {
          return {
            amountDueFormatted: " - ",
            advanceBalanceFormatted: " - ",
            workDoneBalanceFormatted: " - ",
            finalRemainingPayableFormatted: " - ",
          };
        }

        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        if (!contractId) {
          return {
            amountDueFormatted: " - ",
            advanceBalanceFormatted: " - ",
            workDoneBalanceFormatted: " - ",
            finalRemainingPayableFormatted: " - ",
          };
        }

        const balance = this.calculateContractBalanceAsOf(
          contractId,
          new Date().toISOString().slice(0, 10)
        );

        const amountDueBalance =
          (totals.cpcAmountDue || 0) +
          (totals.cpcVat || 0) -
          (totals.paymentGrandTotal || 0);
        const workDoneBalance =
          (totals.contractAmount || 0) +
          (totals.contractVon || 0) -
          (totals.cpcWorkDone || 0);

        return {
          amountDueFormatted: this.formatDetailsCurrency(amountDueBalance),
          advanceBalanceFormatted: this.formatDetailsCurrency(
            balance.advanceBalance
          ),
          workDoneBalanceFormatted:
            this.formatDetailsCurrency(workDoneBalance),
          finalRemainingPayableFormatted: this.formatDetailsCurrency(
            balance.finalPayable
          ),
        };
      },
      hasOverdueBonds() {
        return this.expiringBonds.some((bond) => bond.status === "Overdue");
      },
      bondAlertsMap() {
        const alerts = new Map();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Chỉ lọc các bảo lãnh chưa tất toán
        this.bonds.forEach(bond => {
          if (bond.isSettled || !bond.expiryDate) return;

          const expiryDate = new Date(bond.expiryDate);
          expiryDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

          let currentAlert = alerts.get(bond.contractId) || { overdue: 0, expiring: 0 };

          if (diffDays < 0) currentAlert.overdue++;
          else if (diffDays <= 30) currentAlert.expiring++;

          alerts.set(bond.contractId, currentAlert);
        });
        return alerts;
      },
      processedCpcData() {
        const t0 = performance.now(); // Debug hiệu năng nếu cần

        // Chuẩn bị các Map dữ liệu để truy xuất O(1)
        const contractMap = this.contractMap;
        const projectMap = this.projectMap;
        const vendorMap = this.vendorMap;
        const installmentsMap = this.installmentsByCpcId;
        const bondAlerts = this.bondAlertsMap;

        const result = this.cpcItems.map(item => {
          // Lấy nhanh các thông tin liên quan qua Map
          const itemInstallments = installmentsMap.get(item.id) || [];
          const contract = contractMap.get(item.contractId) || {};
          const project = projectMap.get(item.projectId) || {};
          const vendor = vendorMap.get(item.vendorId) || {};

          // Tính tổng tiền đã trả
          const totalAmountPaid = itemInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);

          // Xác định ngày thanh toán gần nhất
          let latestDate = "N/A";
          if (itemInstallments.length > 0) {
            let maxTime = 0;
            itemInstallments.forEach(inst => {
              const d = inst.date ? new Date(inst.date).getTime() : 0;
              if (d > maxTime) maxTime = d;
              // Check thêm ngày trong swap nếu có
              if (inst.isSwap && inst.swapPayments) {
                inst.swapPayments.forEach(sp => {
                  const sd = sp.date ? new Date(sp.date).getTime() : 0;
                  if (sd > maxTime) maxTime = sd;
                });
              }
            });
            if (maxTime > 0) latestDate = appUtils.format.date(new Date(maxTime));
          }

          // Lấy cảnh báo bảo lãnh từ Map đã tính sẵn
          let bondAlert = null;
          const alertStatus = bondAlerts.get(item.contractId);
          if (alertStatus) {
            if (alertStatus.overdue > 0) {
              bondAlert = {
                level: "danger",
                class: "bond-alert-danger",
                message: `CẢNH BÁO: ${alertStatus.overdue} bảo lãnh QUÁ HẠN!`
              };
            } else if (alertStatus.expiring > 0) {
              bondAlert = {
                level: "warning",
                class: "bond-alert-warning",
                message: `${alertStatus.expiring} bảo lãnh sắp hết hạn (<=30 ngày)`
              };
            }
          }

          return {
            ...item,
            projectName: project.name || "N/A",
            vendorName: vendor.name || "N/A",
            vendorNameAbbr: vendor.abbrName || vendor.name || "N/A",
            contractNo: contract.contractNo || "N/A",
            isUsd: contract.currency === "USD",
            installments: itemInstallments,
            totalAmountPaid,
            latestPaymentDate: latestDate,
            statusInfo: this.getStatusInfo(item, itemInstallments, totalAmountPaid),
            bondAlert
          };
        });

        const t1 = performance.now();
        console.log(`[Performance] Processed ${result.length} CPCs in ${Math.round(t1 - t0)}ms`);
        return result;
      },
      availableCpcProjects() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.projects,
          linkingData: this.processedCpcData,
          linkKey: "projectId",
          searchTerm: this.viewStates.cpcTracking.filter.projectSearch,
          vueInstance: this,
        });
      },
      availableCpcVendors() {
        const relevantData = appUtils.filter.filterBySelectedIds(
          this.processedCpcData,
          this.viewStates.cpcTracking.filter.projectId,
          "projectId"
        );

        return appUtils.filter.getAvailableItems({
          sourceData: this.vendors,
          linkingData: relevantData,
          linkKey: "vendorId",
          searchTerm: this.viewStates.cpcTracking.filter.vendorSearch,
          vueInstance: this,
        });
      },
      availableCpcContracts() {
        let relevantData = this.processedCpcData;
        relevantData = appUtils.filter.filterBySelectedIds(
          relevantData,
          this.viewStates.cpcTracking.filter.projectId,
          "projectId"
        );
        relevantData = appUtils.filter.filterBySelectedIds(
          relevantData,
          this.viewStates.cpcTracking.filter.vendorId,
          "vendorId"
        );

        const contractIdsInUse = new Set(
          relevantData.map((item) => item.contractId).filter(Boolean)
        );
        const allContractObjects = this.contracts.filter((c) =>
          contractIdsInUse.has(c.id)
        );

        const search = (
          this.viewStates.cpcTracking.filter.contractNoSearch || ""
        ).toLowerCase();

        if (!search) {
          return allContractObjects.sort((a, b) =>
            a.contractNo.localeCompare(b.contractNo)
          );
        }

        return allContractObjects
          .filter((c) => c.contractNo.toLowerCase().includes(search))
          .sort((a, b) => a.contractNo.localeCompare(b.contractNo));
      },
      filteredCpcData() {
        const state = this.viewStates.cpcTracking;
        let data = this.processedCpcData; // Không dùng spread [...] ở đây để tiết kiệm bộ nhớ

        // 1. Lọc theo ID (Nhanh nhất)
        if (state.filter.projectId.length > 0) {
          data = data.filter(item => state.filter.projectId.includes(item.projectId));
        }
        if (state.filter.vendorId.length > 0) {
          data = data.filter(item => state.filter.vendorId.includes(item.vendorId));
        }
        if (state.filter.contractId.length > 0) {
          data = data.filter(item => state.filter.contractId.includes(item.contractId));
        }

        // 2. Lọc theo Status
        if (state.filter.status.length > 0) {
          const targetStatuses = state.filter.status.map(s => s.toLowerCase().replace(/ /g, ""));
          data = data.filter(item => targetStatuses.includes(item.statusInfo.statusKey));
        }

        // 3. Lọc theo từ khóa (Search) - Tối ưu hóa chuỗi
        if (state.searchTerm) {
          const term = appUtils.text.normalizeVietnamese(state.searchTerm);
          data = data.filter(item => {
            // Chỉ tìm trên các trường định danh chính để tăng tốc
            return (item.cpcIdentifier && item.cpcIdentifier.toLowerCase().includes(term)) ||
              (item.contractNo && item.contractNo.toLowerCase().includes(term)) ||
              (item.vendorNameAbbr && item.vendorNameAbbr.toLowerCase().includes(term)) ||
              (item.contents && appUtils.text.normalizeVietnamese(item.contents).includes(term)) ||
              (item.lineTracking && appUtils.text.normalizeVietnamese(item.lineTracking).includes(term));
          });
        }

        // 4. Sắp xếp (Sorting)
        if (state.sortBy) {
          const dir = state.sortDirection === 'asc' ? 1 : -1;
          const key = state.sortBy;

          data.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];

            if (valA === valB) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;

            if (typeof valA === 'string') {
              return dir * valA.localeCompare(valB);
            }
            return dir * (valA - valB);
          });
        }

        return data;
      },
      paginatedCpcData() {
        const state = this.viewStates.cpcTracking;
        const start = (state.currentPage - 1) * state.perPage;
        return this.filteredCpcData.slice(start, start + state.perPage);
      },
      formattedPaginatedCpcData() {
        return this.paginatedCpcData.map((item) => ({
          ...item,
          amountFormatted: appUtils.format.currency(item.amount),
          amountUsdFormatted: this.formatCurrencyUSD(item.amountUsd),
          totalAmountPaidFormatted: appUtils.format.currency(
            item.totalAmountPaid
          ),
          installmentsFormatted: (item.installments || []).map((inst) => ({
            ...inst,
            amountFormatted: appUtils.format.currency(inst.amount),
          })),
        }));
      },
      totalPages() {
        const state = this.viewStates.cpcTracking;
        return Math.ceil(this.filteredCpcData.length / state.perPage);
      },
      totalAmountCpcTracking() {
        const total = this.paginatedCpcData.reduce(
          (sum, item) => sum + (item.amount || 0),
          0
        );
        return appUtils.format.currency(total);
      },
      totalAmountPaidCpcTracking() {
        const total = this.paginatedCpcData.reduce(
          (sum, item) => sum + (item.totalAmountPaid || 0),
          0
        );
        return appUtils.format.currency(total);
      },
      allPaymentsDashboard() {
        return this.installments.flatMap((inst) => {
          const cpc = this.processedCpcDataMap.get(inst.cpcId) || {};
          const vendor = this.vendorMap.get(inst.vendorId) || {};

          const baseData = {
            ...cpc,
            vendorNameAbbr: vendor.abbrName || cpc.vendorName,
            originalAmount: cpc.amount,
            originalInstallmentId: inst.id,
            contractNo: cpc.contractNo,
          };

          if (!inst.isSwap) {
            return [
              {
                ...baseData,
                ...inst,
                isSwapRow: false,
              },
            ];
          }

          if (
            inst.isSwap &&
            inst.swapPayments &&
            inst.swapPayments.length > 0
          ) {
            return inst.swapPayments.map((subPay, idx) => ({
              ...baseData,
              id: `${inst.id}_swap_sub_${idx}`,

              amount: subPay.amount,
              amountFormatted: appUtils.format.currency(subPay.amount),
              date: subPay.date,
              paymentSource: subPay.source || "SWAP Offset",

              contents: `(SWAP - ${inst.vendorSWAP || "N/A"}) ${cpc.contents || ""
                }`,

              isSwapRow: true,

              _parentInstallment: inst,
              _subPaymentIndex: idx,
            }));
          }

          return [];
        });
      },
      paymentsFilteredByDate() {
        const filter = this.viewStates.paymentDashboard.filter;
        if (!filter.startDate || !filter.endDate)
          return this.allPaymentsDashboard;
        const start = new Date(filter.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        return this.allPaymentsDashboard.filter((p) => {
          if (!p.date) return false;
          const paymentDate = new Date(p.date);
          return (
            !isNaN(paymentDate.getTime()) &&
            paymentDate >= start &&
            paymentDate <= end
          );
        });
      },
      availableProjects() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.projects,
          linkingData: this.paymentsFilteredByDate,
          linkKey: "projectId",
          searchTerm: this.viewStates.paymentDashboard.filter.projectSearch,
          vueInstance: this,
        });
      },
      paymentsFilteredByProject() {
        const filter = this.viewStates.paymentDashboard.filter;
        if (filter.projectId.length === 0)
          return this.paymentsFilteredByDate;
        return this.paymentsFilteredByDate.filter((p) =>
          filter.projectId.includes(p.projectId)
        );
      },
      availableVendors() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.vendors,
          linkingData: this.paymentsFilteredByProject,
          linkKey: "vendorId",
          searchTerm: this.viewStates.paymentDashboard.filter.vendorSearch,
          vueInstance: this,
        });
      },
      paymentsFilteredByVendor() {
        const filter = this.viewStates.paymentDashboard.filter;
        if (filter.vendorId.length === 0)
          return this.paymentsFilteredByProject;
        return this.paymentsFilteredByProject.filter((p) =>
          filter.vendorId.includes(p.vendorId)
        );
      },
      availableCodes() {
        const filter = this.viewStates.paymentDashboard.filter;
        const data = this.paymentsFilteredByVendor;
        if (!filter.codeSearch)
          return [
            ...new Set(data.map((item) => item.code).filter(Boolean)),
          ].sort();
        return [
          ...new Set(
            data
              .map((c) => c.code)
              .filter(
                (c) =>
                  c &&
                  c.toLowerCase().includes(filter.codeSearch.toLowerCase())
              )
          ),
        ].sort();
      },
      paymentsFilteredByCode() {
        const filter = this.viewStates.paymentDashboard.filter;
        if (filter.code.length === 0) return this.paymentsFilteredByVendor;
        return this.paymentsFilteredByVendor.filter((p) =>
          filter.code.includes(p.code)
        );
      },
      availablePaymentSources() {
        const filter = this.viewStates.paymentDashboard.filter;
        const data = this.paymentsFilteredByCode;
        const sources = [
          ...new Set(
            data.map((item) => item.paymentSource).filter(Boolean)
          ),
        ].sort();
        if (!filter.paymentSourceSearch) return sources;
        return sources.filter((s) =>
          s.toLowerCase().includes(filter.paymentSourceSearch.toLowerCase())
        );
      },
      filteredPaymentsDashboard() {
        const state = this.viewStates.paymentDashboard;
        let payments = [...this.paymentsFilteredByCode];
        if (state.filter.paymentSource.length > 0)
          payments = payments.filter((p) =>
            state.filter.paymentSource.includes(p.paymentSource)
          );
        if (state.sortBy)
          payments.sort((a, b) => {
            let valA = a[state.sortBy],
              valB = b[state.sortBy];
            if (valA == null) return 1;
            if (valB == null) return -1;
            if (["amount", "originalAmount"].includes(state.sortBy)) {
              valA = parseFloat(valA);
              valB = parseFloat(valB);
            } else if (["date", "paymentDueDate"].includes(state.sortBy)) {
              valA = new Date(valA);
              valB = new Date(valB);
              if (isNaN(valA)) return 1;
              if (isNaN(valB)) return -1;
            } else if (typeof valA === "string") {
              valA = valA.toLowerCase();
              valB = valB.toLowerCase();
            }
            if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
            if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
            return 0;
          });
        return payments;
      },
      paginatedFilteredPaymentsDashboard() {
        const state = this.viewStates.paymentDashboard;
        const start = (state.currentPage - 1) * state.perPage;
        return this.filteredPaymentsDashboard.slice(
          start,
          start + state.perPage
        );
      },
      formattedPaginatedPaymentsDashboard() {
        return this.paginatedFilteredPaymentsDashboard.map((p) => ({
          ...p,
          amountFormatted: appUtils.format.currency(p.amount),
          originalAmountFormatted: appUtils.format.currency(
            p.originalAmount
          ),
        }));
      },
      dashboardTotalPages() {
        const state = this.viewStates.paymentDashboard;
        return Math.ceil(
          this.filteredPaymentsDashboard.length / state.perPage
        );
      },
      totalAmountPaidDashboard() {
        return this.filteredPaymentsDashboard.reduce(
          (sum, payment) => sum + (payment.amount || 0),
          0
        );
      },

      allSwapsDashboard() {
        const swaps = this.installments
          .filter((i) => i.isSwap)
          .map((inst) => {
            const cpc = this.processedCpcDataMap.get(inst.cpcId) || {};

            const totalSwapPaidAmount = (inst.swapPayments || []).reduce(
              (sum, p) => sum + p.amount,
              0
            );
            const swapDates = (inst.swapPayments || [])
              .map((p) => new Date(p.date))
              .filter((d) => !isNaN(d));
            const latestSwapPaymentDate =
              swapDates.length > 0
                ? appUtils.format.date(new Date(Math.max(...swapDates)))
                : "";

            const isReceivableSwap = cpc.amount < 0;

            return {
              ...cpc,
              ...inst,
              amount: Math.abs(inst.amount),
              totalSwapPaidAmount,
              latestSwapPaymentDate,
              isExpanded: inst.isExpanded || false,
              transactionType: isReceivableSwap ? "receivable" : "payable",
            };
          });
        return swaps;
      },

      availableSwapProjects() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.projects,
          linkingData: this.allSwapsDashboard,
          linkKey: "projectId",
          searchTerm: this.viewStates.swapDashboard.filter.projectSearch,
          vueInstance: this,
        });
      },
      swapsFilteredByProject() {
        return appUtils.filter.filterBySelectedIds(
          this.allSwapsDashboard,
          this.viewStates.swapDashboard.filter.projectId,
          "projectId"
        );
      },
      availableSwapVendors() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.vendors,
          linkingData: this.swapsFilteredByProject,
          linkKey: "vendorId",
          searchTerm: this.viewStates.swapDashboard.filter.vendorSearch,
          vueInstance: this,
        });
      },
      swapsFilteredByVendor() {
        return appUtils.filter.filterBySelectedIds(
          this.swapsFilteredByProject,
          this.viewStates.swapDashboard.filter.vendorId,
          "vendorId"
        );
      },
      availableSwapVendorSWAPs() {
        return [
          ...new Set(
            this.swapsFilteredByVendor
              .map((item) => item.vendorSWAP)
              .filter(Boolean)
          ),
        ].sort();
      },

      filteredSwapsDashboard() {
        const state = this.viewStates.swapDashboard;
        let data = [...this.allSwapsDashboard];

        if (state.filter.projectId.length > 0) {
          data = data.filter((s) =>
            state.filter.projectId.includes(s.projectId)
          );
        }

        if (state.filter.vendorSWAP.length > 0) {
          data = data.filter((s) =>
            state.filter.vendorSWAP.includes(s.vendorSWAP)
          );
        }

        if (state.filter.startDate || state.filter.endDate) {
          const start = state.filter.startDate
            ? new Date(state.filter.startDate)
            : null;
          const end = state.filter.endDate
            ? new Date(state.filter.endDate)
            : null;
          if (start) start.setHours(0, 0, 0, 0);
          if (end) end.setHours(23, 59, 59, 999);

          data = data.filter((item) => {
            const itemDate = item.date ? new Date(item.date) : null;
            if (!itemDate) return false;
            return (
              (!start || itemDate >= start) && (!end || itemDate <= end)
            );
          });
        }

        if (state.sortBy) {
          data.sort((a, b) => {
            let valA = a[state.sortBy],
              valB = b[state.sortBy];
            if (state.sortDirection === "asc") return valA > valB ? 1 : -1;
            return valA < valB ? 1 : -1;
          });
        }

        return data;
      },

      paginatedSwapsDashboard() {
        const state = this.viewStates.swapDashboard;
        const start = (state.currentPage - 1) * state.perPage;
        return this.filteredSwapsDashboard.slice(
          start,
          start + state.perPage
        );
      },
      formattedPaginatedSwapsDashboard() {
        return this.paginatedSwapsDashboard.map((s) => ({
          ...s,
          amountFormatted: this.formatCurrency(s.amount),
          totalSwapPaidAmountFormatted: this.formatCurrency(
            s.totalSwapPaidAmount
          ),
        }));
      },
      swapDashboardTotalPages() {
        const state = this.viewStates.swapDashboard;
        return Math.ceil(
          this.filteredSwapsDashboard.length / state.perPage
        );
      },
      swapDashboardAvailableColumns() {
        return [
          { key: "projectName", label: this.t("project") },
          { key: "vendorName", label: this.t("vendor") },
          { key: "cpcIdentifier", label: this.t("cpc") },
          { key: "contractNo", label: this.t("contract") },
          { key: "vendorSWAP", label: this.t("vendorSWAP") },
          { key: "swapAgreement", label: this.t("swapAgreement") },
          { key: "swapProduct", label: this.t("swapProduct") },
          { key: "date", label: this.t("agreementDate") },
          { key: "amount", label: this.t("amount") },
          { key: "totalSwapPaidAmount", label: this.t("swapAmountPaid") },
          {
            key: "latestSwapPaymentDate",
            label: this.t("swapPaymentDate"),
          },
          { key: "status", label: this.t("status") },
        ];
      },
      visibleSwapDashboardColumns() {
        return this.swapDashboardAvailableColumns.filter(
          (col) => this.swapDashboardColumnVisibility[col.key]
        );
      },

      allBondsDashboard() {
        return this.bonds.map((bond) => {
          const project = this.projectMap.get(bond.projectId) || {};
          const vendor = this.vendorMap.get(bond.vendorId) || {};
          const contract = this.contractMap.get(bond.contractId) || {};

          return {
            ...bond,
            projectName: project.name || "N/A",
            vendorName: vendor.name || "N/A",
            vendorNameAbbr: vendor.abbrName || vendor.name || "N/A",
            contractNo: contract.contractNo || "N/A",
            issuingBankName: bond.issuingBank,
            amountFormatted: appUtils.format.currency(bond.amount),
          };
        });
      },

      availableBondProjects() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.projects,
          linkingData: this.allBondsDashboard,
          linkKey: "projectId",
          searchTerm: "",
          vueInstance: this,
        });
      },
      filteredAvailableBondProjects() {
        const searchTerm =
          this.viewStates.bondDashboard.filter.projectSearch;
        if (!searchTerm) return this.availableBondProjects;
        return this.availableBondProjects.filter((p) =>
          appUtils.text
            .normalizeVietnamese(p.name)
            .includes(appUtils.text.normalizeVietnamese(searchTerm))
        );
      },
      bondsFilteredByProject() {
        const filter = this.viewStates.bondDashboard.filter;
        if (filter.projectId.length === 0) return this.allBondsDashboard;
        return this.allBondsDashboard.filter((b) =>
          filter.projectId.includes(b.projectId)
        );
      },
      availableBondVendors() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.vendors,
          linkingData: this.bondsFilteredByProject,
          linkKey: "vendorId",
          searchTerm: "",
          vueInstance: this,
        });
      },
      filteredAvailableBondVendors() {
        const searchTerm =
          this.viewStates.bondDashboard.filter.vendorSearch;
        if (!searchTerm) return this.availableBondVendors;
        return this.availableBondVendors.filter((v) =>
          appUtils.text
            .normalizeVietnamese(v.name)
            .includes(appUtils.text.normalizeVietnamese(searchTerm))
        );
      },

      bondsFilteredByVendor() {
        const filter = this.viewStates.bondDashboard.filter;
        if (filter.vendorId.length === 0)
          return this.bondsFilteredByProject;
        return this.bondsFilteredByProject.filter((b) =>
          filter.vendorId.includes(b.vendorId)
        );
      },
      availableBondContracts() {
        const contractIds = new Set(
          this.bondsFilteredByVendor.map((b) => b.contractId)
        );
        return this.contracts
          .filter((c) => contractIds.has(c.id))
          .sort((a, b) => a.contractNo.localeCompare(b.contractNo));
      },

      filteredAvailableBondContracts() {
        const searchTerm =
          this.viewStates.bondDashboard.filter.contractNoSearch;
        if (!searchTerm) return this.availableBondContracts;
        return this.availableBondContracts.filter((c) =>
          c.contractNo.toLowerCase().includes(searchTerm.toLowerCase())
        );
      },
      bondsFilteredByContract() {
        const filter = this.viewStates.bondDashboard.filter;
        if (filter.contractId.length === 0)
          return this.bondsFilteredByVendor;
        return this.bondsFilteredByVendor.filter((b) =>
          filter.contractId.includes(b.contractId)
        );
      },
      availableBondTypes() {
        return [
          ...new Set(
            this.bondsFilteredByContract
              .map((item) => item.bondType)
              .filter(Boolean)
          ),
        ].sort();
      },
      filteredAvailableBondTypes() {
        const filter = this.viewStates.bondDashboard.filter;
        if (!filter.typeSearch) return this.availableBondTypes;
        return this.availableBondTypes.filter((t) =>
          t.toLowerCase().includes(filter.typeSearch.toLowerCase())
        );
      },
      filteredBondsDashboard() {
        const state = this.viewStates.bondDashboard;
        let bonds = [...this.bondsFilteredByContract];

        if (state.filter.bondType.length > 0) {
          bonds = bonds.filter((b) =>
            state.filter.bondType.includes(b.bondType)
          );
        }

        if (state.filter.status.length > 0) {
          bonds = bonds.filter((bond) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expiryDate = new Date(bond.expiryDate);
            expiryDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((expiryDate - today) / 864e5);

            let currentStatus = "Active";
            if (bond.isSettled) {
              currentStatus = "Settled";
            } else if (diffDays < 0) {
              currentStatus = "Overdue";
            } else if (diffDays <= 30) {
              currentStatus = "Expiring Soon";
            }

            return state.filter.status.includes(currentStatus);
          });
        }

        if (state.sortBy)
          bonds.sort((a, b) => {
            let valA = a[state.sortBy],
              valB = b[state.sortBy];
            if (valA == null) return 1;
            if (valB == null) return -1;
            if (state.sortBy === "amount") {
              valA = parseFloat(valA);
              valB = parseFloat(valB);
            } else if (["issueDate", "expiryDate"].includes(state.sortBy)) {
              valA = new Date(valA);
              valB = new Date(valB);
              if (isNaN(valA)) return 1;
              if (isNaN(valB)) return -1;
            } else if (typeof valA === "string") {
              valA = valA.toLowerCase();
              valB = valB.toLowerCase();
            }
            if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
            if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
            return 0;
          });
        return bonds;
      },
      paginatedFilteredBondsDashboard() {
        const state = this.viewStates.bondDashboard;
        const start = (state.currentPage - 1) * state.perPage;
        return this.filteredBondsDashboard.slice(
          start,
          start + state.perPage
        );
      },
      formattedPaginatedBondsDashboard() {
        return this.paginatedFilteredBondsDashboard.map((bond) => ({
          ...bond,
          amountFormatted: appUtils.format.currency(bond.amount),
        }));
      },
      bondDashboardTotalPages() {
        const state = this.viewStates.bondDashboard;
        return Math.ceil(
          this.filteredBondsDashboard.length / state.perPage
        );
      },

      expiringBonds() {
        const notifications = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const latestExpiringBondPerType = new Map();

        this.bonds
          .filter((bond) => !bond.isSettled)
          .forEach((bond) => {
            const contract =
              this.contracts.find((c) => c.id === bond.contractId) || {};
            if (!contract.id) return;

            const compositeKey = `${contract.contractNo}_${bond.bondType}`;
            const currentLatest =
              latestExpiringBondPerType.get(compositeKey);
            const bondExpiry = new Date(bond.expiryDate);
            if (isNaN(bondExpiry.getTime())) return;

            if (
              !currentLatest ||
              bondExpiry > new Date(currentLatest.expiryDate)
            ) {
              const bank =
                this.banks.find((b) => b.id === bond.bankId) || {};
              const vendor =
                this.vendors.find((v) => v.id === contract.vendorId) || {};

              latestExpiringBondPerType.set(compositeKey, {
                ...bond,
                contractId: contract.id,
                projectId: contract.projectId,
                vendorId: contract.vendorId,
                contractNo: contract.contractNo,
                issuingBankName: bank.name,
              });
            }
          });

        latestExpiringBondPerType.forEach((bond) => {
          const expiryDate = new Date(bond.expiryDate);
          const diffTime = expiryDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          let message = "",
            status = "";

          if (diffDays < 0) {
            message = this.t("bond_status_overdue", { days: -diffDays });
            status = "Overdue";
          } else if (diffDays <= 30) {
            message = this.t("bond_status_expiring", { days: diffDays });
            status = "Expiring Soon";
          }

          if (message) {
            notifications.push({ ...bond, message, status });
          }
        });

        return notifications.sort(
          (a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)
        );
      },
      visibleColumns() {
        return this.availableColumns.filter(
          (col) => this.columnVisibility[col.key]
        );
      },
      availableColumns() {
        return [
          { key: "projectName", label: this.t("project") },
          { key: "cpcIdentifier", label: this.t("cpc") },
          { key: "contractNo", label: this.t("contract") },
          { key: "contents", label: this.t("contents") },
          { key: "code", label: this.t("code") },
          { key: "vendorName", label: this.t("vendor") },
          { key: "amount", label: this.t("amountInclVAT") },
          { key: "receivedDate", label: this.t("receivedDate") },
          { key: "paymentDueDate", label: this.t("paymentDueDate") },
          { key: "totalAmountPaid", label: this.t("amountPaid") },
          { key: "latestPaymentDate", label: this.t("paymentDate") },
          { key: "moreInfo", label: "More Info", noSort: true },
          { key: "status", label: "Status" },
          { key: "lineTracking", label: this.t("lineTracking") },
          { key: "notes", label: this.t("notes") },
        ];
      },
      dashboardPaymentAvailableColumns() {
        return [
          { key: "projectName", label: this.t("project") },
          { key: "cpcIdentifier", label: this.t("cpc") },
          { key: "contractNo", label: this.t("contract") },
          { key: "contents", label: this.t("contents") },
          { key: "code", label: this.t("code") },
          { key: "vendorName", label: this.t("vendor") },
          { key: "originalAmount", label: this.t("amountInclVAT") },
          { key: "paymentDueDate", label: this.t("paymentDueDate") },
          { key: "amount", label: this.t("amountPaid") },
          { key: "date", label: this.t("paymentDate") },
          { key: "paymentSource", label: this.t("paymentSource") },
        ];
      },
      visiblePaymentDashboardColumns() {
        return this.dashboardPaymentAvailableColumns.filter(
          (col) => this.dashboardPaymentColumnVisibility[col.key]
        );
      },
      dashboardBondAvailableColumns() {
        return [
          { key: "projectName", label: this.t("project") },
          { key: "contractNo", label: this.t("contract") },
          { key: "vendorName", label: this.t("vendor") },
          { key: "bondNumber", label: this.t("bondNumber") },
          { key: "ref", label: this.t("ref") },
          { key: "bondType", label: this.t("bondType") },
          { key: "amount", label: this.t("amount") },
          { key: "issueDate", label: this.t("issueDate") },
          { key: "expiryDate", label: this.t("expiryDate") },
          { key: "issuingBankName", label: this.t("issuingBank") },
          { key: "quickSettle", label: "Quick Settle", noSort: true },
          { key: "status", label: "Status" },
        ];
      },
      contractDashboardAvailableColumns() {
        return [
          { key: "projectName", label: this.t("project") },
          { key: "glAccount", label: this.t("glaccount") },
          { key: "code", label: this.t("code") },
          { key: "department", label: this.t("department") },
          { key: "contractSystemNo", label: this.t("contractSystemNo") },
          { key: "vendorNo", label: this.t("vendorNo") },
          { key: "vendorName", label: this.t("vendor") },
          { key: "contractNo", label: this.t("contract") },
          { key: "currency", label: this.t("currency") },
          { key: "date", label: this.t("date") },
          { key: "description", label: this.t("details") },
          {
            key: "contractAmountTotal",
            label: this.t("contractAmountTotal"),
          },
          { key: "vonTotal", label: this.t("vonTotal") },
          { key: "contractVatTotal", label: this.t("contractVatTotal") },
          {
            key: "contractGrandTotal",
            label: this.t("contractGrandTotal"),
          },

          { key: "paidAmountExclVAT", label: this.t("paidAmountExclVAT") },
          { key: "paidVatAmount", label: this.t("paidVatAmount") },
          { key: "paidAmountInclVAT", label: this.t("paidAmountInclVAT") },
          {
            key: "invoiceAmountTotal",
            label: this.t("invoiceAmountTotal"),
          },
          { key: "invoiceVatTotal", label: this.t("invoiceVatTotal") },
          { key: "invoiceGrandTotal", label: this.t("invoiceGrandTotal") },
        ];
      },
      contractDashboardData() {
        const filters = this.viewStates.contractDashboard.filter;

        const hasActiveFilters =
          filters.projectId.length > 0 ||
          filters.vendorId.length > 0 ||
          filters.contractId.length > 0 ||
          filters.code.length > 0;

        if (!hasActiveFilters) {
          return [];
        }

        let filteredContracts = this.contracts;

        if (filters.projectId.length > 0) {
          filteredContracts = filteredContracts.filter((item) =>
            filters.projectId.includes(item.projectId)
          );
        }
        if (filters.vendorId.length > 0) {
          filteredContracts = filteredContracts.filter((item) =>
            filters.vendorId.includes(item.vendorId)
          );
        }
        if (filters.contractId.length > 0) {
          filteredContracts = filteredContracts.filter((item) =>
            filters.contractId.includes(item.id)
          );
        }
        if (filters.code.length > 0) {
          filteredContracts = filteredContracts.filter((item) =>
            filters.code.includes(item.code)
          );
        }

        return filteredContracts.map((contract) => {
          const project = this.projectMap.get(contract.projectId) || {};
          const vendor = this.vendorMap.get(contract.vendorId) || {};
          const cpcItemsForContract =
            this.cpcItemsByContractId.get(contract.id) || [];
          const cpcIdsForContract = cpcItemsForContract.map(
            (cpc) => cpc.id
          );

          const relevantInstallments = cpcIdsForContract.flatMap((cpcId) =>
            (this.installmentsByCpcId.get(cpcId) || []).filter(
              (inst) => !inst.isSwap
            )
          );

          const paidAmountInclVAT = relevantInstallments.reduce(
            (sum, inst) => sum + (inst.amountVND || inst.amount || 0),
            0
          );
          let paidAmountExclVAT = 0;
          if (contract.currency === "USD") {
            paidAmountExclVAT = paidAmountInclVAT;
          } else {
            cpcItemsForContract.forEach((cpc) => {
              const cpcInstallments = relevantInstallments.filter(
                (i) => i.cpcId === cpc.id
              );
              const totalPaidForCpc = cpcInstallments.reduce(
                (sum, i) => sum + i.amount,
                0
              );
              if (cpc.amount > 0) {
                const paymentRatio = totalPaidForCpc / cpc.amount;
                paidAmountExclVAT +=
                  (cpc.amountExclVAT || 0) * paymentRatio;
              } else {
                paidAmountExclVAT += totalPaidForCpc;
              }
            });
          }
          const paidVatAmount = paidAmountInclVAT - paidAmountExclVAT;

          const detailsTable =
            this.cpcDetailRowsByContractId.get(contract.id) || [];
          let contractTotals = {};

          if (contract.currency === "USD") {
            let totalContractAmountVND = 0;
            let totalVonVND = 0;
            let totalInvoiceVND = 0;

            detailsTable.forEach((row) => {
              const invoiceAmountUSD = row.invoiceAmount || 0;
              const contractAmountUSD = row.contractAmount || 0;
              const vonAmountUSD = row.contractVon || 0;

              let effectiveRate = parseFloat(row.invoiceExchangeRate) || 0;
              if (effectiveRate <= 0 && row.cpcNo) {
                const cpcItem = cpcItemsForContract.find(
                  (cpc) => cpc.cpcIdentifier === row.cpcNo
                );
                if (cpcItem && cpcItem.exchangeRate > 0) {
                  effectiveRate = cpcItem.exchangeRate;
                }
              }
              totalInvoiceVND += Math.round(
                invoiceAmountUSD * effectiveRate
              );
              totalContractAmountVND += Math.round(
                contractAmountUSD * effectiveRate
              );
              totalVonVND += Math.round(vonAmountUSD * effectiveRate);
            });

            contractTotals = {
              invoiceAmountTotal: totalInvoiceVND,
              invoiceVatTotal: 0,
              invoiceGrandTotal: totalInvoiceVND,
              contractAmountTotal: totalContractAmountVND,
              vonTotal: totalVonVND,
              contractVatTotal: 0,
              contractGrandTotal: totalContractAmountVND + totalVonVND,
            };
          } else {
            contractTotals = {
              invoiceAmountTotal: detailsTable.reduce(
                (sum, row) => sum + (row.invoiceAmount || 0),
                0
              ),
              invoiceVatTotal: detailsTable.reduce(
                (sum, row) => sum + (row.invoiceVat || 0),
                0
              ),
              invoiceGrandTotal: detailsTable.reduce(
                (sum, row) => sum + (row.invoiceTotal || 0),
                0
              ),
              contractAmountTotal: detailsTable.reduce(
                (sum, row) => sum + (row.contractAmount || 0),
                0
              ),
              vonTotal: detailsTable.reduce(
                (sum, row) => sum + (row.contractVon || 0),
                0
              ),
              contractVatTotal: detailsTable.reduce(
                (sum, row) => sum + (row.contractVat || 0),
                0
              ),
              contractGrandTotal: detailsTable.reduce(
                (sum, row) => sum + (row.contractTotal || 0),
                0
              ),
            };
          }

          return {
            id: contract.id,
            contractNo: contract.contractNo,
            currency: contract.currency,
            date: contract.date,
            description: contract.description,
            code: contract.code,
            department: contract.department,
            contractSystemNo: contract.contractSystemNo,
            glAccount: contract.glAccount,
            projectId: contract.projectId,
            vendorId: contract.vendorId,
            projectName: project.name,
            vendorName: vendor.name,
            vendorNo: vendor.vendorNo || "",
            paidAmountInclVAT,
            paidAmountExclVAT,
            paidVatAmount,
            ...contractTotals,
          };
        });
      },

      availableContractProjects() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.projects,
          linkingData: this.contracts,
          linkKey: "projectId",
          searchTerm: "",
          vueInstance: this,
        });
      },

      contractsFilteredByProject() {
        const filter = this.viewStates.contractDashboard.filter;
        if (filter.projectId.length === 0)
          return this.contractDashboardData;
        return this.contractDashboardData.filter((item) =>
          filter.projectId.includes(item.projectId)
        );
      },
      availableContractVendors() {
        return appUtils.filter.getAvailableItems({
          sourceData: this.vendors,
          linkingData: this.contractsFilteredByProject,
          linkKey: "vendorId",
          searchTerm: "",
          vueInstance: this,
        });
      },
      filteredAvailableContractVendors() {
        const searchTerm =
          this.viewStates.contractDashboard.filter.vendorSearch;
        if (!searchTerm) return this.availableContractVendors;
        return this.availableContractVendors.filter((v) =>
          appUtils.text
            .normalizeVietnamese(v.name)
            .includes(appUtils.text.normalizeVietnamese(searchTerm))
        );
      },

      contractsFilteredByVendor() {
        const filter = this.viewStates.contractDashboard.filter;
        if (filter.vendorId.length === 0)
          return this.contractsFilteredByProject;
        return this.contractsFilteredByProject.filter((item) =>
          filter.vendorId.includes(item.vendorId)
        );
      },
      availableContractContracts() {
        const contractIds = new Set(
          this.contractsFilteredByVendor.map((c) => c.id)
        );
        return this.contracts
          .filter((c) => contractIds.has(c.id))
          .sort((a, b) => a.contractNo.localeCompare(b.contractNo));
      },
      filteredAvailableContractContracts() {
        const searchTerm =
          this.viewStates.contractDashboard.filter.contractNoSearch;
        if (!searchTerm) return this.availableContractContracts;
        return this.availableContractContracts.filter((c) =>
          c.contractNo.toLowerCase().includes(searchTerm.toLowerCase())
        );
      },
      filteredAvailableContractProjects() {
        const searchTerm =
          this.viewStates.contractDashboard.filter.projectSearch;
        if (!searchTerm) return this.availableContractProjects;
        return this.availableContractProjects.filter((p) =>
          appUtils.text
            .normalizeVietnamese(p.name)
            .includes(appUtils.text.normalizeVietnamese(searchTerm))
        );
      },

      contractsFilteredByContract() {
        const filter = this.viewStates.contractDashboard.filter;
        if (filter.contractId.length === 0)
          return this.contractsFilteredByVendor;
        return this.contractsFilteredByVendor.filter((item) =>
          filter.contractId.includes(item.id)
        );
      },
      availableContractCodes() {
        return [
          ...new Set(
            this.contractsFilteredByContract
              .map((item) => item.code)
              .filter(Boolean)
          ),
        ].sort();
      },
      filteredAvailableContractCodes() {
        const filter = this.viewStates.contractDashboard.filter;
        if (!filter.codeSearch) return this.availableContractCodes;
        return this.availableContractCodes.filter((c) =>
          c.toLowerCase().includes(filter.codeSearch.toLowerCase())
        );
      },
      filteredContractDashboardData() {
        const state = this.viewStates.contractDashboard;
        let data = [...this.contractsFilteredByContract];
        if (state.filter.code.length > 0)
          data = data.filter((item) =>
            state.filter.code.includes(item.code)
          );
        if (state.sortBy)
          data.sort((a, b) => {
            let valA = a[state.sortBy],
              valB = b[state.sortBy];
            if (valA == null) return 1;
            if (valB == null) return -1;
            if (
              [
                "paidAmountExclVAT",
                "paidVatAmount",
                "paidAmountInclVAT",
                "invoiceAmountTotal",
                "invoiceVatTotal",
                "invoiceGrandTotal",
                "contractAmountTotal",
                "vonTotal",
                "contractVatTotal",
                "contractGrandTotal",
              ].includes(state.sortBy)
            ) {
              valA = parseFloat(valA);
              valB = parseFloat(valB);
            } else if (state.sortBy === "date") {
              valA = new Date(valA);
              valB = new Date(valB);
              if (isNaN(valA)) return 1;
              if (isNaN(valB)) return -1;
            } else if (typeof valA === "string") {
              valA = valA.toLowerCase();
              valB = valB.toLowerCase();
            }
            if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
            if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
            return 0;
          });
        return data;
      },
      paginatedContractDashboardData() {
        const state = this.viewStates.contractDashboard;
        const start = (state.currentPage - 1) * state.perPage;
        return this.filteredContractDashboardData.slice(
          start,
          start + state.perPage
        );
      },
      formattedPaginatedContractDashboardData() {
        return this.paginatedContractDashboardData.map((item) => ({
          ...item,
          paidAmountExclVATFormatted: appUtils.format.number(
            item.paidAmountExclVAT
          ),
          paidVatAmountFormatted: appUtils.format.number(
            item.paidVatAmount
          ),
          paidAmountInclVATFormatted: appUtils.format.number(
            item.paidAmountInclVAT
          ),
          invoiceAmountTotalFormatted: appUtils.format.number(
            item.invoiceAmountTotal
          ),
          invoiceVatTotalFormatted: appUtils.format.number(
            item.invoiceVatTotal
          ),
          invoiceGrandTotalFormatted: appUtils.format.number(
            item.invoiceGrandTotal
          ),
          contractAmountTotalFormatted: appUtils.format.number(
            item.contractAmountTotal
          ),
          vonTotalFormatted: appUtils.format.number(item.vonTotal),
          contractVatTotalFormatted: appUtils.format.number(
            item.contractVatTotal
          ),
          contractGrandTotalFormatted: appUtils.format.number(
            item.contractGrandTotal
          ),
        }));
      },
      contractDashboardTotalPages() {
        const state = this.viewStates.contractDashboard;
        return Math.ceil(
          this.filteredContractDashboardData.length / state.perPage
        );
      },
      totalPaidAmountInclVATContractDashboard() {
        return this.filteredContractDashboardData.reduce(
          (sum, item) => sum + (item.paidAmountInclVAT || 0),
          0
        );
      },
      totalPaidAmountExclVATContractDashboard() {
        return this.filteredContractDashboardData.reduce(
          (sum, item) => sum + (item.paidAmountExclVAT || 0),
          0
        );
      },
      totalPaidVatAmountContractDashboard() {
        return this.filteredContractDashboardData.reduce(
          (sum, item) => sum + (item.paidVatAmount || 0),
          0
        );
      },
      totalInvoiceAmountContractDashboard() {
        return this.filteredContractDashboardData.reduce(
          (sum, item) => sum + (item.invoiceAmountTotal || 0),
          0
        );
      },
      totalInvoiceVatContractDashboard() {
        return this.filteredContractDashboardData.reduce(
          (sum, item) => sum + (item.invoiceVatTotal || 0),
          0
        );
      },
      totalInvoiceGrandTotalContractDashboard() {
        return this.filteredContractDashboardData.reduce(
          (sum, item) => sum + (item.invoiceGrandTotal || 0),
          0
        );
      },
      totalContractAmountContractDashboard() {
        return this.filteredContractDashboardData.reduce(
          (sum, item) => sum + (item.contractAmountTotal || 0),
          0
        );
      },
      totalVonContractDashboard() {
        return this.filteredContractDashboardData.reduce(
          (sum, item) => sum + (item.vonTotal || 0),
          0
        );
      },
      totalContractVatContractDashboard() {
        return this.filteredContractDashboardData.reduce(
          (sum, item) => sum + (item.contractVatTotal || 0),
          0
        );
      },
      totalContractGrandTotalContractDashboard() {
        return this.filteredContractDashboardData.reduce(
          (sum, item) => sum + (item.contractGrandTotal || 0),
          0
        );
      },
      visibleContractDashboardColumns() {
        return this.contractDashboardAvailableColumns.filter(
          (col) => this.contractDashboardColumnVisibility[col.key]
        );
      },
    },
    methods: {
      hasPermission(permission) {
        return hasAuthPermission(this.currentUserPermissions, permission);
      },
      requirePermission(permission, deniedMessage = null) {
        if (this.hasPermission(permission)) return true;
        this.showToast(
          deniedMessage || "Ban khong co quyen thuc hien thao tac nay.",
          "error"
        );
        return false;
      },
      handleSupabaseSyncStatus(statusPayload = {}) {
        const statusCode = (statusPayload.status || "").toUpperCase();
        const disabledStatuses = new Set([
          "DISABLED_OR_MISSING_CONFIG",
          "MISSING_CONFIG",
          "SDK_MISSING",
          "START_FAILED",
        ]);
        this.supabaseSync.enabled = !disabledStatuses.has(statusCode);
        if (typeof statusPayload.connected === "boolean") {
          this.supabaseSync.connected = statusPayload.connected;
        }
        this.supabaseSync.status = statusPayload.status || this.supabaseSync.status || "UNKNOWN";
        this.supabaseSync.reason = statusPayload.reason || "";
        this.supabaseSync.lastEventAt =
          statusPayload.at || new Date().toISOString();
      },
      initializeAdminAccessState() {
        const overrides = getStoredGoogleRoleOverrides();
        this.adminAccess.roleOverrides = overrides;
        if (
          !this.assignableRoles.includes(this.adminAccess.selectedRole)
        ) {
          this.adminAccess.selectedRole = this.assignableRoles[0];
        }
      },
      normalizeRoleEmail(email) {
        return (email || "").toString().trim().toLowerCase();
      },
      saveAdminRoleAssignment() {
        if (!this.isAdminUser) {
          this.showToast("Ban khong co quyen quan tri phan quyen.", "error");
          return;
        }
        const email = this.normalizeRoleEmail(this.adminAccess.email);
        if (!email || !email.includes("@")) {
          this.showToast("Email khong hop le.", "error");
          return;
        }
        if (!this.assignableRoles.includes(this.adminAccess.selectedRole)) {
          this.showToast("Role khong hop le.", "error");
          return;
        }
        const nextOverrides = {
          ...(this.adminAccess.roleOverrides || {}),
          [email]: this.adminAccess.selectedRole,
        };
        this.adminAccess.roleOverrides = nextOverrides;
        storeGoogleRoleOverrides(nextOverrides);
        this.adminAccess.email = "";
        this.showToast(
          `Da cap role ${this.adminAccess.selectedRole} cho ${email}.`,
          "success"
        );
      },
      removeAdminRoleAssignment(email) {
        if (!this.isAdminUser) {
          this.showToast("Ban khong co quyen quan tri phan quyen.", "error");
          return;
        }
        const normalizedEmail = this.normalizeRoleEmail(email);
        if (!normalizedEmail) return;
        const nextOverrides = { ...(this.adminAccess.roleOverrides || {}) };
        delete nextOverrides[normalizedEmail];
        this.adminAccess.roleOverrides = nextOverrides;
        storeGoogleRoleOverrides(nextOverrides);
        this.showToast(`Da xoa role custom cua ${normalizedEmail}.`, "info");
      },
      async logoutCurrentUser() {
        try {
          if (typeof this.authContext?.logout === "function") {
            await this.authContext.logout();
            return;
          }
          window.location.reload();
        } catch (error) {
          console.error("Logout failed:", error);
          this.showToast("Khong the dang xuat. Vui long thu lai.", "error");
        }
      },
      async bulkSyncCpcsAndInstallmentsFromUpload(contractId) {
        if (!this.requirePermission("import.execute")) return;
        const contract = this.contracts.find(c => c.id === contractId);
        if (!contract) return;

        // Lấy tất cả các dòng thuộc hợp đồng này có chứa mã CPC tạm thời
        const allRelevantRows = this.cpcDetailRows.filter(r => r.contractId === contractId && r.tempCpcNoForSync);
        if (allRelevantRows.length === 0) return;

        // 1. Ép tính toán lại Net (Amount Due) cho từng dòng
        allRelevantRows.forEach(row => {
          row.cpcAmountDue = (Number(row.cpcPaymentOfWorkdone) || 0) +
            (Number(row.cpcAdvance) || 0) +
            (Number(row.cpcRepayment) || 0) +
            (Number(row.cpcRetention) || 0) +
            (Number(row.cpcOtherDeduction) || 0);
        });

        // 2. Gom nhóm theo tempCpcNoForSync
        const groupedByCpc = allRelevantRows.reduce((acc, row) => {
          const cpcKey = row.tempCpcNoForSync;
          if (!acc[cpcKey]) acc[cpcKey] = { rows: [], payments: [] };
          acc[cpcKey].rows.push(row);

          if (row.tempPaymentDate && row.tempPaymentAmount) {
            acc[cpcKey].payments.push({
              date: appUtils.format.date(new Date(row.tempPaymentDate)),
              amount: row.tempPaymentAmount,
              paymentSource: "Excel Import"
            });
          }
          return acc;
        }, {});

        try {
          const isUsd = contract.currency === "USD";

          for (const cpcNo in groupedByCpc) {
            const data = groupedByCpc[cpcNo];
            const aggregated = this._aggregateCpcDataFromDetailRows(data.rows, isUsd);

            let existingCpc = this.cpcItems.find(c => c.contractId === contractId && c.cpcIdentifier === cpcNo);
            let targetCpcId;

            const cpcFields = {
              contractId, cpcIdentifier: cpcNo,
              projectId: contract.projectId, vendorId: contract.vendorId,
              contents: aggregated.finalContents,
              amount: isUsd ? 0 : aggregated.finalAmount,
              amountExclVAT: isUsd ? 0 : aggregated.amountDue,
              vatAmount: isUsd ? 0 : aggregated.vatAmount,
              amountUsd: isUsd ? aggregated.amountDue : 0,
              paymentDueDate: aggregated.paymentDueDate,
              isUsd
            };

            if (existingCpc) {
              targetCpcId = existingCpc.id;
              await updateCpcItemFields(databaseService, targetCpcId, cpcFields);
              Object.assign(existingCpc, cpcFields);
            } else {
              const createdCpc = await addCpcItem(databaseService, cpcFields);
              targetCpcId = createdCpc.id;
              this.cpcItems.push(createdCpc);
            }

            if (data.payments.length > 0) {
              const rate = isUsd ? (existingCpc?.exchangeRate || 25000) : 0;
              const installmentsToSave = data.payments.map(p => ({
                ...p, cpcId: targetCpcId, contractId, projectId: contract.projectId, vendorId: contract.vendorId,
                isUsd, amountUsd: isUsd ? p.amount : 0, exchangeRate: rate,
                amountVND: isUsd ? Math.round(p.amount * rate) : p.amount,
                amount: isUsd ? Math.round(p.amount * rate) : p.amount
              }));
              await replaceInstallmentsForCpc(
                databaseService,
                targetCpcId,
                installmentsToSave
              );
            }
          }

          this.installments = await getAllInstallments(databaseService);
          this.syncPaymentsToDetails(contractId);

          // 3. Dọn dẹp các biến tạm trên allRelevantRows và CSDL
          allRelevantRows.forEach(r => {
            delete r.tempPaymentDate; delete r.tempPaymentAmount; delete r.tempCpcNoForSync;
          });
          await saveDetailRows(databaseService, allRelevantRows);

          this.showToast("Đã đồng bộ Net Amount và Thanh toán (Gom nhóm theo CPC).", "success");
        } catch (err) { console.error(err); this.showToast("Lỗi đồng bộ.", "error"); }
      },
      goToVendorPartnerFromOverview(vendorId, vendorName) {
        if (!vendorId) return;

        // 1. Thiết lập state cho tab Vendor Partner để tự động tìm và chọn đúng NCC
        this.viewStates.vendorPartner.selectedId = vendorId;
        this.viewStates.vendorPartner.searchTerm = vendorName; // Để hiện ra ở sidebar trái

        // 2. Chuyển sang tab Vendor Partner
        this.currentTab = 'vendor-partner';

        // 3. Thông báo nhẹ
        this.showToast(this.t('filteringContractForVendor', { vendorName: vendorName }), 'info');
      },
      goToContractOverviewFromVendor(contract) {
        if (!contract || !contract.id) return;

        // 1. Thiết lập bộ lọc cho tab CPC Details/Overview để hệ thống nhận diện đúng ngữ cảnh
        this.viewStates.cpcDetails.filter.projectId = [contract.projectId];
        this.viewStates.cpcDetails.filter.vendorId = [contract.vendorId];

        // 2. Sử dụng $nextTick để đảm bảo các bộ lọc trên đã được áp dụng trước khi chọn ID hợp đồng
        this.$nextTick(() => {
          this.viewStates.cpcDetails.filter.selectedContractId = contract.id;

          // 3. Chuyển sang tab Tổng quan hợp đồng
          this.currentTab = 'contract-overview';

          // 4. Thông báo nhẹ cho người dùng
          this.showToast(this.t('filteringBondForContract', { contractNo: contract.contractNo }), 'info');
        });
      },
      async exportCpcDetailsToPdf() {
        const contractNo = this.selectedContractDetails?.contractNo || "Summary";
        const projectName = this.selectedContractDetails?.projectName || "Project";

        const originalPhase = this.viewStates.cpcDetails.activePhaseId;

        this.viewStates.cpcDetails.activePhaseId = 'summary';

        this.showToast("Đang khởi tạo bản in Grand Total...", "info");

        await this.$nextTick();

        const element = document.querySelector(".main-content > div > div");

        const opt = {
          margin: [10, 5, 10, 5], // top, left, bottom, right (mm)
          filename: `Summary_A3_${contractNo}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2, // Tăng độ nét
            useCORS: true,
            letterRendering: true
          },
          jsPDF: {
            unit: 'mm',
            format: 'a3',
            orientation: 'landscape' // Khổ ngang A3 cho bảng rộng
          },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        html2pdf().set(opt).from(element).save().then(() => {
          this.viewStates.cpcDetails.activePhaseId = originalPhase;
          this.showToast("Xuất PDF thành công!", "success");
        }).catch(err => {
          console.error("PDF Export Error:", err);
          this.showToast("Lỗi khi xuất PDF", "error");
          this.viewStates.cpcDetails.activePhaseId = originalPhase;
        });
      },
      getOrdinal(n) {
        if (this.language !== 'en') return '';
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
      },
      toggleAllRepaymentBasis(isSelected) {
        if (!this.currentDetailItem) return;

        if (isSelected) {
          this.currentDetailItem.repaymentBasisItems =
            this.availableRepaymentBasis.map((b) => b.id);
        } else {
          this.currentDetailItem.repaymentBasisItems = [];
        }
        this.updateFormulasInModal("cpcRepayment", false);
      },

      exportInvoiceAgingToExcel() {
        const state = this.viewStates.invoiceAging;
        const isContractMode = state.viewMode === "contract";
        const data = isContractMode
          ? this.filteredContractAgingData
          : this.filteredInvoiceAgingData;

        if (!data || data.length === 0) {
          this.showToast(this.t("noMatchingData"), "warning");
          return;
        }

        let exportData = [];
        if (isContractMode) {
          exportData = data.map((item) => ({
            [this.t("project")]: item.projectName,
            [this.t("contractDateLabel")]: item.contractDate,
            [this.t("contract")]: item.contractNo,
            [this.t("vendorNo")]: item.vendorNo,
            [this.t("vendor")]: item.vendorName,
            [this.t("descriptionLabel")]: item.description,
            [this.t("age1_30")]: item.age1_30,
            [this.t("age31_60")]: item.age31_60,
            [this.t("age61_90")]: item.age61_90,
            [this.t("ageOver90")]: item.ageOver90,
            [this.t("totalOverdue")]: item.remainingTotal,
          }));
        } else {
          exportData = data.map((item) => ({
            [this.t("project")]: item.projectName,
            [this.t("contract")]: item.contractNo,
            [this.t("vendor")]: item.vendorName,
            [this.t("invoiceNoLabel")]: item.invoiceNo,
            [this.t("date")]: item.invoiceDate,
            [this.t("postingDate")]: item.invoicePostingDate,
            [this.t("ageDays")]: item.age,
            [this.t("invoiceNet")]: item.remainingNet,
            [this.t("invoiceVat")]: item.remainingVat,
            [this.t("invoiceTotal")]: item.remainingTotal,
          }));
        }

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Aging");
        XLSX.writeFile(
          wb,
          `Aging_${state.viewMode}_${state.filter.reportDate}.xlsx`
        );
      },
      calculateDiffDays(dateStr) {
        if (!dateStr) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(dateStr);
        targetDate.setHours(0, 0, 0, 0);
        const diffTime = targetDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      },
      changePerPage(viewState, offset) {
        const options = [5, 10, 25, 50, 100];
        let currentIndex = options.indexOf(viewState.perPage);

        if (currentIndex === -1) currentIndex = 1;

        let nextIndex = currentIndex + offset;

        if (nextIndex >= 0 && nextIndex < options.length) {
          viewState.perPage = options[nextIndex];
          viewState.currentPage = 1;
        }
      },
      changeSwapDashboardYear(offset) {
        const currentYear = this.swapDashboardYear;
        const newYear = currentYear + offset;
        this.viewStates.swapDashboard.filter.startDate = `${newYear}-01-01`;
        this.viewStates.swapDashboard.filter.endDate = `${newYear}-12-31`;
        this.viewStates.swapDashboard.currentPage = 1;
        this.showToast(`SWAP: Switched to year ${newYear}`, "info");
      },

      toggleSwapExpand(swapItem) {
        const original = this.installments.find(
          (i) => i.id === swapItem.id
        );
        if (original) {
          original.isExpanded = !original.isExpanded;
        }
      },

      changeDashboardYear(offset) {
        const currentYear = this.paymentDashboardYear;
        const newYear = currentYear + offset;

        this.viewStates.paymentDashboard.filter.startDate = `${newYear}-01-01`;
        this.viewStates.paymentDashboard.filter.endDate = `${newYear}-12-31`;

        this.viewStates.paymentDashboard.currentPage = 1;
        this.showToast(`Switched to ${newYear}`, "info");
      },
      handleCpcUsdToggle() {
        if (this.currentEditItem.isUsd) {
          if (
            !this.currentEditItem.exchangeRate ||
            this.currentEditItem.exchangeRate === 0
          ) {
            this.currentEditItem.exchangeRate = 23500;
            this.currentEditItem.displayExchangeRate = "23.500";
          }
          if (!this.currentEditItem.amountUsd) {
            this.currentEditItem.amountUsd = 0;
            this.currentEditItem.displayAmountUsd = "0.00";
          }
          this.calculateVndFromUsd();
        } else {
          this.currentEditItem.displayAmountExclVAT = (
            this.currentEditItem.amountExclVAT || 0
          ).toLocaleString("vi-VN");
          this.currentEditItem.displayVatAmount = (
            this.currentEditItem.vatAmount || 0
          ).toLocaleString("vi-VN");
          this.currentEditItem.displayAmount = (
            this.currentEditItem.amount || 0
          ).toLocaleString("vi-VN");

          this.currentEditItem.amountUsd = 0;
          this.currentEditItem.displayAmountUsd = "0.00";
        }
      },
      handleUsdToggle(installment) {
        if (installment.isUsd) {
          if (!installment.exchangeRate || installment.exchangeRate === 0) {
            installment.exchangeRate = 23500;
            installment.displayExchangeRate = "23.500";
          }
          if (!installment.amountUsd) {
            installment.amountUsd = 0;
            installment.displayAmountUsd = "0.00";
          }
          this.calculateInstallmentVndFromUsd(installment);
        } else {
          installment.displayAmount = (
            installment.amount || 0
          ).toLocaleString("vi-VN");

          installment.amountUsd = 0;
          installment.displayAmountUsd = "0.00";
        }
      },
      getModalTotalPaid() {
        if (!this.currentEditItem || !this.currentEditItem.installments)
          return 0;

        const isUsd = this.currentEditItem.isUsd;

        return this.currentEditItem.installments.reduce((sum, inst) => {
          const val = isUsd ? inst.amountUsd || 0 : inst.amount || 0;
          return sum + val;
        }, 0);
      },

      getModalTotalPaidFormatted() {
        const total = this.getModalTotalPaid();
        if (this.currentEditItem && this.currentEditItem.isUsd) {
          return this.formatCurrencyUSD(total);
        }
        return this.formatCurrency(total);
      },

      getModalRemainingAmount() {
        if (!this.currentEditItem) return 0;

        const isUsd = this.currentEditItem.isUsd;
        const totalAmount = isUsd
          ? this.currentEditItem.amountUsd || 0
          : this.currentEditItem.amount || 0;
        const paid = this.getModalTotalPaid();

        if (totalAmount < 0) {
          return Math.abs(totalAmount) - paid;
        }

        return totalAmount - paid;
      },

      getModalRemainingFormatted() {
        const remaining = this.getModalRemainingAmount();
        if (this.currentEditItem && this.currentEditItem.isUsd) {
          return this.formatCurrencyUSD(remaining);
        }
        return this.formatCurrency(remaining);
      },

      getModalPaymentPercentage() {
        if (!this.currentEditItem) return 0;
        const isUsd = this.currentEditItem.isUsd;
        const totalAmount = Math.abs(
          isUsd
            ? this.currentEditItem.amountUsd || 0
            : this.currentEditItem.amount || 0
        );

        if (totalAmount === 0) return 100;

        const paid = this.getModalTotalPaid();
        return (paid / totalAmount) * 100;
      },
      manualRecalculateVendorBalance() {
        this.showToast(this.t("calculatingData"), "info");
        setTimeout(() => {
          this._recalculateAllDetailRowsAfterLoad();
          this.showToast(this.t("refreshSuccess"), "success");
        }, 100);
      },
      getBondTypeColorClass(bondType) {
        if (!bondType) return "";

        const type = bondType.toLowerCase().trim();

        const preEn = this.translations.en.prepaymentBond.toLowerCase();
        const preVi = this.translations.vi.prepaymentBond.toLowerCase();
        if (type === preEn || type === preVi) return "text-bond-prepayment";

        const perfEn = this.translations.en.performanceBond.toLowerCase();
        const perfVi = this.translations.vi.performanceBond.toLowerCase();
        if (type === perfEn || type === perfVi)
          return "text-bond-performance";

        const warEn = this.translations.en.warrantyBond.toLowerCase();
        const warVi = this.translations.vi.warrantyBond.toLowerCase();
        if (type === warEn || type === warVi) return "text-bond-warranty";

        return "";
      },

      toggleSidebarFixed() {
        this.isSidebarFixed = !this.isSidebarFixed;
        localStorage.setItem("isSidebarFixed", this.isSidebarFixed);

        this.$nextTick(() => {
          if (typeof lucide !== "undefined") {
            lucide.createIcons();
          }
        });
      },

      toggleBondGroupExpand(group) {
        const keys = this.viewStates.bondDashboard.expandedGroupKeys;
        const keyIndex = keys.indexOf(group.groupKey);

        if (keyIndex > -1) {
          keys.splice(keyIndex, 1);
        } else {
          keys.push(group.groupKey);
        }
      },

      getBondRowClass(bond) {
        const statusObj = this.getBondStatusClassForDashboard(bond);
        if (bond.isSettled) return "status-settled";
        if (statusObj.message.includes("Overdue")) return "status-danger";
        if (statusObj.message.includes("Expiring")) return "status-warning";
        return "status-active";
      },

      checkPhaseAndTriggerUpload() {
        const activePhaseId = this.viewStates.cpcDetails.activePhaseId;

        const hasPhases = this.selectedContractDetails?.phases?.length > 0;

        if (activePhaseId === "summary" && hasPhases) {
          this.showToast(this.t("errorUploadInSummaryMode"), "warning");
          return;
        }

        this.triggerDetailsFileUpload();
      },
      async addNewPhase() {
        const contractName = this.selectedContractDetails.contractNo;
        const phaseName = prompt(
          `Nhập tên Giai đoạn/Phần việc mới cho HĐ ${contractName}:`,
          `Phần ${(this.selectedContractDetails.phases?.length || 0) + 1}`
        );

        if (phaseName && phaseName.trim()) {
          const contract = this.contracts.find(
            (c) => c.id === this.selectedContractDetails.id
          );
          if (!contract) return;

          if (!contract.phases) contract.phases = [];

          const newPhase = {
            id: "phase_" + Date.now(),
            name: phaseName.trim(),
          };

          contract.phases.push(newPhase);

          await putContractRecord(databaseService, contract);

          this.viewStates.cpcDetails.activePhaseId = newPhase.id;
          this.showToast(this.t("phaseAddedSuccess"), "success");
        }
      },

      async renamePhase(phase) {
        const newName = prompt("Nhập tên mới:", phase.name);
        if (newName && newName.trim()) {
          const contract = this.contracts.find(
            (c) => c.id === this.selectedContractDetails.id
          );
          const targetPhase = contract.phases.find(
            (p) => p.id === phase.id
          );
          if (targetPhase) {
            targetPhase.name = newName.trim();
            await putContractRecord(databaseService, contract);
            this.showToast(this.t("phaseRenamedSuccess"), "success");
          }
        }
      },

      async deletePhase(phase) {
        const contractId = this.selectedContractDetails.id;
        const rowsToDelete = this.cpcDetailRows.filter(
          (r) => r.contractId === contractId && r.phaseId === phase.id
        );
        const count = rowsToDelete.length;

        let message = `Bạn có chắc chắn muốn xóa giai đoạn "${phase.name}"?`;
        if (count > 0) {
          message += `\n\n⚠️ CẢNH BÁO: Giai đoạn này đang chứa ${count} dòng dữ liệu sẽ bị mất.`;
        }

        if (confirm(message)) {
          try {
            // 1. Xóa các dòng thuộc Phase này trong DB
            if (count > 0) {
              const idsToDelete = rowsToDelete.map((r) => r.id);
              await deleteDetailRowsByIds(databaseService, idsToDelete);
              this.cpcDetailRows = this.cpcDetailRows.filter((r) => !idsToDelete.includes(r.id));
            }

            // 2. Cập nhật danh sách Phase trong Contract
            const contract = this.contracts.find((c) => c.id === contractId);
            if (contract && contract.phases) {
              contract.phases = contract.phases.filter((p) => p.id !== phase.id);

              // --- LOGIC MỚI: Nếu không còn Phase nào, tạo 3 dòng trống mặc định ---
              if (contract.phases.length === 0) {
                // Kiểm tra xem hiện tại có dòng nào không thuộc phase không (dòng Summary cũ)
                const globalRows = this.cpcDetailRows.filter(r => r.contractId === contractId && !r.phaseId);

                if (globalRows.length === 0) {
                  const newEmptyRows = [];
                  for (let i = 0; i < 3; i++) {
                    const emptyRow = this.createEmptyDetailRow(contractId, i);
                    emptyRow.phaseId = null; // Đảm bảo thuộc về Grand Total
                    newEmptyRows.push(emptyRow);
                  }

                  const persistedRows = await addDetailRows(databaseService, newEmptyRows);
                  this.cpcDetailRows.push(...persistedRows);
                }
              }

              await putContractRecord(databaseService, contract);
            }

            this.viewStates.cpcDetails.activePhaseId = "summary";
            this.showToast(this.t("phaseDeletedSuccess"), "success");
          } catch (error) {
            console.error("Lỗi khi xóa giai đoạn:", error);
            this.showToast(this.t("phaseDeleteError"), "error");
          }
        }
      },
      deleteDetailRow(itemId) {
        // Kiểm tra an toàn: Không cho phép xóa nếu chỉ còn 1 dòng hiển thị
        if (this.displayedContractDetailTable.length <= 1) {
          return;
        }

        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeletion"),
          message: this.t("confirmDeleteRow"),
          onConfirm: async () => {
            const itemIndex = this.cpcDetailRows.findIndex((item) => item.id === itemId);
            if (itemIndex > -1) {
              try {
                await deleteDetailRowById(databaseService, itemId);
                this.cpcDetailRows.splice(itemIndex, 1);
                this.showToast(this.t("rowDeleted"), "success");
              } catch (error) {
                console.error("Error deleting detail row:", error);
              }
            }
          },
        });
      },

      exportSwapDashboardToExcel() {
        if (this.filteredSwapsDashboard.length === 0) {
          this.showToast(this.t("noSwapData"), "warning");
          return;
        }

        const dataToExport = this.filteredSwapsDashboard.map((item) => ({
          [this.t("project")]: item.projectName,
          [this.t("vendor")]: item.vendorName,
          [this.t("cpc")]: item.cpcIdentifier,
          [this.t("contract")]: item.contractNo,
          [this.t("vendorSWAP")]: item.vendorSWAP,
          [this.t("swapAgreement")]: item.swapAgreement,
          [this.t("swapProduct")]: item.swapProduct || "",
          [this.t("agreementDate")]: item.date,
          [this.t("amount")]: item.amount,
          [this.t("swapAmountPaid")]: item.totalSwapPaidAmount,
          [this.t("swapPaymentDate")]: item.latestSwapPaymentDate,
          [this.t("status")]: this.getSwapStatusInfo(item).statusText,
          [this.t("transactionType")]:
            item.transactionType === "receivable"
              ? this.t("transactionTypeReceivable")
              : this.t("transactionTypePayable"),
          [this.t("swapInformation")]: item.swapInformation,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);

        const colWidths = Object.keys(dataToExport[0]).map(() => ({
          wch: 20,
        }));
        ws["!cols"] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "SWAP Dashboard");

        const fileName = `SWAP_Export_${appUtils.format.date(
          new Date()
        )}.xlsx`;
        XLSX.writeFile(wb, fileName);

        this.showToast(this.t("changesSavedSuccess"), "success");
      },
      selectProjectForContract(project) {
        if (this.currentEditContract) {
          this.currentEditContract.projectName = project.name;
          this.currentEditContract.projectId = project.id;
        }

        this.isContractProjectDropdownVisible = false;
        this.activeContractProjectIndex = -1;
      },

      handleContractProjectInputBlur() {
        setTimeout(() => {
          this.isContractProjectDropdownVisible = false;
        }, 200);
      },

      navigateProjectsForContract(event) {
        if (
          !this.isContractProjectDropdownVisible ||
          this.filteredProjectsForContractModal.length === 0
        )
          return;

        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            if (
              this.activeContractProjectIndex <
              this.filteredProjectsForContractModal.length - 1
            ) {
              this.activeContractProjectIndex++;
              this.scrollToActiveItem(event.target);
            }
            break;
          case "ArrowUp":
            event.preventDefault();
            if (this.activeContractProjectIndex > 0) {
              this.activeContractProjectIndex--;
              this.scrollToActiveItem(event.target);
            }
            break;
          case "Enter":
            if (this.activeContractProjectIndex >= 0) {
              event.preventDefault();
              this.selectProjectForContract(
                this.filteredProjectsForContractModal[
                this.activeContractProjectIndex
                ]
              );
            } else {
              this.isContractProjectDropdownVisible = false;
            }
            break;
          case "Escape":
            this.isContractProjectDropdownVisible = false;
            break;
        }
      },
      goToBondDashboardFromTracking(item) {
        this.clearAllFilters();

        if (item.contractId) {
          this.viewStates.bondDashboard.filter.contractId = [
            item.contractId,
          ];
        }

        this.viewStates.bondDashboard.filter.status = [
          "Overdue",
          "Expiring Soon",
        ];

        this.$nextTick(() => {
          this.currentTab = "cpc-bond-dashboard";

          this.showToast(
            this.t("filteringBondForContract", {
              contractNo: item.contractNo,
            }),
            "warning"
          );
        });
      },
      goToContractDashboardFromVendor(vendorItem) {
        if (!vendorItem) return;

        let targetVendorId = vendorItem.vendorId;

        if (typeof targetVendorId !== "number") {
          const realVendor = this.vendors.find(
            (v) => v.vendorNo === vendorItem.vendorNo
          );
          if (realVendor) {
            targetVendorId = realVendor.id;
          } else {
            this.showToast(this.t("vendorNoContractWarning"), "warning");
            return;
          }
        }

        const filterState = this.viewStates.contractDashboard.filter;

        filterState.projectId = [];
        filterState.contractId = [];
        filterState.code = [];
        filterState.projectSearch = "";
        filterState.vendorSearch = "";
        filterState.contractNoSearch = "";
        filterState.codeSearch = "";

        this.$nextTick(() => {
          filterState.vendorId = [targetVendorId];

          this.viewStates.contractDashboard.currentPage = 1;

          this.$nextTick(() => {
            this.currentTab = "cpc-contract-dashboard";

            this.showToast(
              this.t("filteringContractForVendor", {
                vendorName: vendorItem.vendorName,
              }),
              "info"
            );
          });
        });
      },
      scrollToActiveItem(inputElement) {
        this.$nextTick(() => {
          const container = inputElement.closest(
            ".custom-dropdown-container"
          );
          if (!container) return;

          const menu = container.querySelector(".custom-dropdown-menu");
          if (!menu) return;

          const activeItem = menu.querySelector("li.active");

          if (activeItem) {
            activeItem.scrollIntoView({ block: "nearest" });
          }
        });
      },

      selectProject(project) {
        this.currentEditItem.projectName = project.name;

        this.isProjectDropdownVisible = false;
        this.activeProjectIndex = -1;
      },

      handleProjectInputBlur() {
        setTimeout(() => {
          this.isProjectDropdownVisible = false;
        }, 200);
      },

      navigateProjects(event) {
        if (
          !this.isProjectDropdownVisible ||
          this.filteredProjectsForModal.length === 0
        )
          return;

        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            if (
              this.activeProjectIndex <
              this.filteredProjectsForModal.length - 1
            ) {
              this.activeProjectIndex++;
              this.scrollToActiveItem(event.target);
            }
            break;
          case "ArrowUp":
            event.preventDefault();
            if (this.activeProjectIndex > 0) {
              this.activeProjectIndex--;
              this.scrollToActiveItem(event.target);
            }
            break;
          case "Enter":
            if (this.activeProjectIndex >= 0) {
              event.preventDefault();
              this.selectProject(
                this.filteredProjectsForModal[this.activeProjectIndex]
              );
            } else {
              this.isProjectDropdownVisible = false;
            }
            break;
          case "Escape":
            this.isProjectDropdownVisible = false;
            break;
        }
      },

      selectContract(contract) {
        this.currentEditItem.contractNo = contract.contractNo;

        this.autoFillFromMasterContract();

        this.isContractDropdownVisible = false;
        this.activeContractIndex = -1;
      },

      handleContractInputBlur() {
        setTimeout(() => {
          this.isContractDropdownVisible = false;
        }, 200);
      },

      navigateContracts(event) {
        if (
          !this.isContractDropdownVisible ||
          this.filteredContractsForModal.length === 0
        )
          return;

        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            if (
              this.activeContractIndex <
              this.filteredContractsForModal.length - 1
            ) {
              this.activeContractIndex++;
              this.scrollToActiveItem(event.target);
            }
            break;
          case "ArrowUp":
            event.preventDefault();
            if (this.activeContractIndex > 0) {
              this.activeContractIndex--;
              this.scrollToActiveItem(event.target);
            }
            break;
          case "Enter":
            if (this.activeContractIndex >= 0) {
              event.preventDefault();
              this.selectContract(
                this.filteredContractsForModal[this.activeContractIndex]
              );
            } else {
              this.isContractDropdownVisible = false;
            }
            break;
          case "Escape":
            this.isContractDropdownVisible = false;
            break;
        }
      },

      formatDoc(cmd, value = null) {
        document.execCommand(cmd, false, value);
        this.$nextTick(() => {
          if (this.$refs.notesEditor) {
            this.$refs.notesEditor.focus();
            this.updateNotesContent({ target: this.$refs.notesEditor });
          }
        });
      },

      formatTableAlign(alignType) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        let node = selection.anchorNode;
        if (node.nodeType === 3) node = node.parentNode;

        while (
          node &&
          node.nodeName !== "TD" &&
          node.nodeName !== "TH" &&
          !node.classList?.contains("notes-edit-area")
        ) {
          node = node.parentNode;
        }

        if (node && (node.nodeName === "TD" || node.nodeName === "TH")) {
          node.style.textAlign = alignType;

          this.updateNotesContent({ target: this.$refs.notesEditor });
        } else {
          const cmdMap = {
            left: "justifyLeft",
            center: "justifyCenter",
            right: "justifyRight",
          };
          this.formatDoc(cmdMap[alignType]);
        }
      },

      startResize(event) {
        this.isResizingNotes = true;
        window.addEventListener("mousemove", this.doResize);
        window.addEventListener("mouseup", this.stopResize);
      },
      doResize(event) {
        if (!this.isResizingNotes) return;

        const newWidth = window.innerWidth - event.clientX;

        const minWidth = 300;
        const maxWidth = 800;

        this.notesPanelWidth = Math.max(
          minWidth,
          Math.min(newWidth, maxWidth)
        );
      },
      stopResize() {
        this.isResizingNotes = false;
        window.removeEventListener("mousemove", this.doResize);
        window.removeEventListener("mouseup", this.stopResize);

        localStorage.setItem("notesPanelWidth", this.notesPanelWidth);
      },

      openNotesModal() {
        if (this.selectedContractDetails) {
          this.initializeNotesForContract(this.selectedContractDetails);
          this.isNotesEditing = false;
          this.isNotesModalVisible = true;
        }
      },

      closeNotesModal() {
        if (this.isNotesEditing) {
        }
        this.isNotesModalVisible = false;
        this.isNotesEditing = false;
        this.currentContractNotes = [];
        this.activeNoteTabId = null;
        this.editingTabId = null;
      },

      toggleNotesModal() {
        if (this.isNotesModalVisible) {
          this.closeNotesModal();
        } else {
          this.openNotesModal();
        }
      },

      toggleNotesEdit(isEditing) {
        this.isNotesEditing = isEditing;
        if (isEditing && this.activeNote) {
          this.$nextTick(() => {
            if (this.$refs.notesEditor) {
              this.$refs.notesEditor.innerHTML =
                this.activeNote.content || "";
              this.$refs.notesEditor.focus();
            }
          });
        }
      },

      async saveNotes() {
        if (!this.activeNote) return;

        if (this.$refs.notesEditor) {
          this.activeNote.content = this.$refs.notesEditor.innerHTML;
        }

        const contractId = this.selectedContractDetails?.id;
        if (!contractId) return;

        const contractIndex = this.contracts.findIndex(
          (c) => c.id === contractId
        );
        if (contractIndex === -1) return;

        const contractToUpdate = JSON.parse(
          JSON.stringify(this.contracts[contractIndex])
        );

        contractToUpdate.significantNotes = JSON.parse(
          JSON.stringify(this.currentContractNotes)
        );

        try {
          await putContractRecord(databaseService, contractToUpdate);

          this.contracts[contractIndex] = contractToUpdate;

          this.showToast(this.t("changesSavedSuccess"), "success");
          this.toggleNotesEdit(false);
        } catch (error) {
          console.error("Error saving significant notes:", error);
          this.showToast(this.t("errorSavingChanges"), "error");
        }
      },

      updateNotesContent(event) {
        if (this.activeNote) {
          this.activeNote.content = event.target.innerHTML;
        }
      },

      initializeNotesForContract(contract) {
        if (!contract) {
          this.currentContractNotes = [];
          this.activeNoteTabId = null;
          return;
        }

        let notes = contract.significantNotes;

        if (typeof notes === "string") {
          if (notes.trim()) {
            this.currentContractNotes = [
              {
                id: "default",
                title: this.t("generalNotes", { default: "General Notes" }),
                content: notes,
              },
            ];
          } else {
            this.currentContractNotes = [];
          }
        } else if (Array.isArray(notes)) {
          this.currentContractNotes = JSON.parse(JSON.stringify(notes));
        } else {
          this.currentContractNotes = [];
        }

        if (this.currentContractNotes.length > 0) {
          this.activeNoteTabId = this.currentContractNotes[0].id;
        } else {
          this.activeNoteTabId = null;
        }
      },

      addNewNoteTab() {
        const tabTitle = prompt(
          this.t("promptNewTabTitle", {
            default: "Please enter a title for the new tab:",
          }),
          `Phụ lục ${this.currentContractNotes.length + 1}`
        );
        if (tabTitle && tabTitle.trim()) {
          const newTab = {
            id: "tab_" + Date.now(),
            title: tabTitle.trim(),
            content: "",
          };
          this.currentContractNotes.push(newTab);
          this.activeNoteTabId = newTab.id;
          this.saveContractWithNewNotesStructure();
        }
      },

      deleteNoteTab(tabToDelete) {
        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeleteTabTitle", { default: "Delete Tab" }),
          message: this.t("confirmDeleteTabMessage", {
            title: tabToDelete.title,
            default: `Are you sure you want to delete the tab "<strong>${tabToDelete.title}</strong>"?`,
          }),
          onConfirm: () => {
            const index = this.currentContractNotes.findIndex(
              (tab) => tab.id === tabToDelete.id
            );
            if (index > -1) {
              this.currentContractNotes.splice(index, 1);

              if (this.activeNoteTabId === tabToDelete.id) {
                this.activeNoteTabId =
                  this.currentContractNotes.length > 0
                    ? this.currentContractNotes[Math.max(0, index - 1)].id
                    : null;
              }

              this.saveContractWithNewNotesStructure();
            }
          },
        });
      },

      startEditingTabTitle(tab) {
        this.editingTabId = tab.id;
        this.editingTabTitle = tab.title;
        this.$nextTick(() => {
          if (this.$refs.tabTitleInput && this.$refs.tabTitleInput[0]) {
            this.$refs.tabTitleInput[0].focus();
            this.$refs.tabTitleInput[0].select();
          }
        });
      },

      saveTabTitle() {
        if (this.editingTabId && this.editingTabTitle.trim()) {
          const tab = this.currentContractNotes.find(
            (t) => t.id === this.editingTabId
          );
          if (tab) {
            tab.title = this.editingTabTitle.trim();
            this.saveContractWithNewNotesStructure();
          }
        }
        this.cancelEditingTabTitle();
      },

      cancelEditingTabTitle() {
        this.editingTabId = null;
        this.editingTabTitle = "";
      },

      async saveContractWithNewNotesStructure() {
        const contractId = this.selectedContractDetails?.id;
        if (!contractId) return;

        const contractIndex = this.contracts.findIndex(
          (c) => c.id === contractId
        );
        if (contractIndex === -1) return;

        const contractToUpdate = JSON.parse(
          JSON.stringify(this.contracts[contractIndex])
        );

        contractToUpdate.significantNotes = JSON.parse(
          JSON.stringify(this.currentContractNotes)
        );

        try {
          await putContractRecord(databaseService, contractToUpdate);

          this.contracts[contractIndex] = contractToUpdate;
        } catch (error) {
          console.error("Error saving new notes structure:", error);
          this.showToast(this.t("errorSavingChanges"), "error");
        }
      },
      handleNotesKeystroke(event) {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "b"
        ) {
          event.preventDefault();
          this.formatDoc("bold");
          return;
        }

        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          if (this.isNotesEditing) {
            this.saveNotes();
          }
          return;
        }

        if (
          event.key === "Tab" ||
          (event.key === "Enter" && (event.ctrlKey || event.metaKey))
        ) {
          const selection = window.getSelection();
          if (!selection.rangeCount) return;

          let node = selection.anchorNode;
          if (node.nodeType === 3) node = node.parentNode;

          const cell = node.closest("td, th");

          if (cell) {
            const row = cell.closest("tr");
            const table = row.closest("table");

            if (row && table) {
              const cells = Array.from(row.querySelectorAll("td, th"));
              const isLastCell = cells.indexOf(cell) === cells.length - 1;

              const rows = Array.from(table.querySelectorAll("tr"));
              const isLastRow = rows.indexOf(row) === rows.length - 1;

              if (event.key === "Tab" && !event.shiftKey) {
                if (isLastCell && isLastRow) {
                  event.preventDefault();
                  this.addTableRow(table, row);
                }
              } else if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey)
              ) {
                event.preventDefault();
                this.addTableRow(table, row);
              }
            }
          }
        }
      },

      addTableRow(table, currentRow) {
        const newRow = currentRow.cloneNode(true);

        const newCells = newRow.querySelectorAll("td, th");
        newCells.forEach((cell) => {
          cell.innerHTML = "<br>";
        });

        const parent = currentRow.parentNode;
        if (currentRow.nextSibling) {
          parent.insertBefore(newRow, currentRow.nextSibling);
        } else {
          parent.appendChild(newRow);
        }

        this.$nextTick(() => {
          const firstCell = newRow.querySelector("td, th");
          if (firstCell) {
            const range = document.createRange();
            const sel = window.getSelection();

            range.setStart(firstCell, 0);
            range.collapse(true);

            sel.removeAllRanges();
            sel.addRange(range);

            firstCell.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
          }

          this.updateNotesContent({ target: this.$refs.notesEditor });
        });
      },
      downloadCategoryTemplate() {
        const headers = [
          "code",
          "name_vi",
          "name_en",
          "level",
          "parentCode",
        ];
        const ws = XLSX.utils.json_to_sheet([], { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Categories");
        XLSX.writeFile(wb, "report_categories_template.xlsx");
      },

      triggerCategoryUpload() {
        this.$refs.uploadCategoryInput.click();
      },

      handleCategoryUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), {
              type: "array",
            });
            const sheet =
              workbook.Sheets["Categories"] ||
              workbook.Sheets[workbook.SheetNames[0]];
            if (!sheet) {
              this.showToast(
                this.t("errorSheetNotFound", { sheetName: "Categories" }),
                "error"
              );
              return;
            }
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
            const { toAdd, toUpdate, skippedCount } = prepareCategoryUpsert(
              rows,
              this.reportCategoriesFromDB
            );

            if (toAdd.length > 0 || toUpdate.length > 0) {
              await upsertCategories(databaseService, toAdd, toUpdate);
              this.reportCategoriesFromDB = await getAllCategories(databaseService);

              let message = this.t("categoryUploadSuccess", {
                added: toAdd.length,
                updated: toUpdate.length,
              });
              if (skippedCount > 0) {
                message +=
                  " " +
                  this.t("categoryUploadSkipped", {
                    skipped: skippedCount,
                  });
              }
              this.showToast(message, "success");
            } else if (skippedCount > 0) {
              this.showToast(
                this.t("categoryUploadSkipped", { skipped: skippedCount }),
                "warning"
              );
            } else {
              this.showToast(this.t("noValidDataFound"), "info");
            }
          } catch (error) {
            console.error("Lỗi khi tải lên file hạng mục:", error);
            this.showToast(this.t("errorProcessingExcel"), "error");
          } finally {
            event.target.value = "";
          }
        };
        reader.readAsArrayBuffer(file);
      },

      exportCategories() {
        if (this.reportCategoriesFromDB.length === 0) {
          this.showToast(this.t("errorNoCategoryDataToExport"), "warning");
          return;
        }

        const dataToExport = this.displayCategories.map((cat) => ({
          code: cat.code,
          name_vi: cat.name_vi,
          name_en: cat.name_en,
          level: cat.level,
          parentCode: cat.parentCode,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Categories");
        XLSX.writeFile(
          wb,
          `Report_Categories_Export_${appUtils.format.date(
            new Date()
          )}.xlsx`
        );
        this.showToast(this.t("categoryExportSuccess"), "success");
      },

      openCategoryModal(mode = "add", category = null) {
        this.categoryModalMode = mode;
        if (mode === "add") {
          this.currentEditCategory = {
            code: "",
            name_vi: "",
            name_en: "",
            level: 1,
            parentCode: null,
          };
        } else {
          this.currentEditCategory = JSON.parse(JSON.stringify(category));
        }
        appUtils.ui.toggleModal("categoryManagementModal", "show");
      },

      closeCategoryModal() {
        appUtils.ui.toggleModal("categoryManagementModal", "hide");
        this.currentEditCategory = null;
      },

      async saveCategory() {
        if (!this.requirePermission("masterdata.manage")) return;
        if (!this.currentEditCategory) return;
        const category = this.currentEditCategory;

        if (!category.code || !category.name_vi) {
          this.showToast(this.t("errorCategoryRequired"), "error");
          return;
        }

        const isDuplicate = this.reportCategoriesFromDB.some(
          (c) =>
            c.code.toLowerCase() === category.code.toLowerCase() &&
            c.id !== category.id
        );
        if (isDuplicate) {
          this.showToast(
            this.t("errorCategoryCodeExists", { code: category.code }),
            "error"
          );
          return;
        }

        category.level = category.parentCode ? 2 : 1;

        try {
          await saveCategoryRecord(
            databaseService,
            category,
            this.categoryModalMode
          );
          if (this.categoryModalMode === "add") {
            this.showToast(this.t("categoryAddSuccess"), "success");
          } else {
            this.showToast(this.t("categoryUpdateSuccess"), "success");
          }

          this.reportCategoriesFromDB = await getAllCategories(databaseService);
          this.closeCategoryModal();
        } catch (error) {
          console.error("Lỗi khi lưu hạng mục:", error);
          this.showToast(this.t("categorySaveFailed"), "error");
        }
      },

      deleteCategory(category) {
        if (this.categoryUsageCount[category.code] > 0) {
          this.showToast(this.t("errorCategoryInUse"), "error");
          return;
        }

        let itemsToDelete = [category];
        let message = this.t("confirmDeleteCategory", {
          code: category.code,
          name: category.name_vi,
        });

        if (category.level === 1) {
          const children = this.reportCategoriesFromDB.filter(
            (c) => c.parentCode === category.code
          );
          if (children.length > 0) {
            const childrenInUse = children.some(
              (c) => this.categoryUsageCount[c.code] > 0
            );
            if (childrenInUse) {
              this.showToast(this.t("errorDeleteParentInUse"), "error");
              return;
            }
            itemsToDelete.push(...children);
            message +=
              "<br><br>" +
              this.t("warningDeleteParentCategory", {
                count: children.length,
              });
          }
        }

        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeletion"),
          message: message,
          onConfirm: async () => {
            try {
              const idsToDelete = itemsToDelete.map((item) => item.id);
              const { deletedIds } = await deleteCategoriesByIds(
                databaseService,
                idsToDelete
              );

              this.reportCategoriesFromDB =
                this.reportCategoriesFromDB.filter(
                  (c) => !deletedIds.includes(c.id)
                );

              this.showToast(this.t("categoryDeleteSuccess"), "success");
            } catch (error) {
              console.error("Lỗi khi xóa hạng mục:", error);
              this.showToast(this.t("categoryDeleteFailed"), "error");
            }
          },
        });
      },

      async seedInitialCategories() {
        try {
          console.log(
            "Seeding initial report categories into the database..."
          );

          const defaultReportStructure = [
              {
                code: "11",
                name_vi: "CHI PHÍ MUA BÁN VÀ SÁP NHẬP (M&A)",
                name_en: "M&A COST",
                level: 1,
                children: [
                  {
                    code: "11.1",
                    name_vi: "Chi phí mua vốn",
                    name_en: "Capital Purchase Cost",
                    level: 2,
                  },
                  {
                    code: "11.2",
                    name_vi: "Chi phí mua đất, đền bù",
                    name_en: "Land Purchase & Compensation Cost",
                    level: 2,
                  },
                  {
                    code: "11.3",
                    name_vi: "Chi phí chuyển nhượng dự án",
                    name_en: "Project Transfer Cost",
                    level: 2,
                  },
                  {
                    code: "11.99",
                    name_vi: "Chi phí khác mua bán và sáp nhập khác",
                    name_en: "Other M&A Cost",
                    level: 2,
                  },
                ],
              },
              {
                code: "12",
                name_vi: "CHI PHÍ SỬ DỤNG ĐẤT",
                name_en: "LAND USE COST",
                level: 1,
                children: [
                  {
                    code: "12.1",
                    name_vi: "Trị giá quyền sử dụng đất",
                    name_en: "Land Use Right Value",
                    level: 2,
                  },
                  {
                    code: "12.99",
                    name_vi: "Chi phí sử dụng đất khác",
                    name_en: "Other Land Use Cost",
                    level: 2,
                  },
                ],
              },
              {
                code: "13",
                name_vi: "HẠNG MỤC TRƯỚC XÂY DỰNG",
                name_en: "PRE-CONSTRUCTION",
                level: 1,
                children: [
                  {
                    code: "13.1",
                    name_vi: "Rà phá bom mìn",
                    name_en: "Bomb & Mine Clearance",
                    level: 2,
                  },
                  {
                    code: "13.2",
                    name_vi: "Hàng rào & chốt bảo vệ tạm dự án",
                    name_en: "Temporary Fencing & Security",
                    level: 2,
                  },
                  {
                    code: "13.3",
                    name_vi: "Dọn dẹp, phát quang & tháo dỡ",
                    name_en: "Site Clearance & Demolition",
                    level: 2,
                  },
                  {
                    code: "13.4",
                    name_vi: "Dịch vụ bảo vệ",
                    name_en: "Security Service",
                    level: 2,
                  },
                  {
                    code: "13.5",
                    name_vi: "Bảo hiểm rủi ro trong xây dựng",
                    name_en: "Construction All Risk Insurance",
                    level: 2,
                  },
                  {
                    code: "13.6",
                    name_vi: "Văn phòng tạm",
                    name_en: "Temporary Office",
                    level: 2,
                  },
                  {
                    code: "13.7",
                    name_vi:
                      "Điện nước tạm phục vụ thi công, chống sét tạm",
                    name_en: "Temporary Utilities",
                    level: 2,
                  },
                  {
                    code: "13.8",
                    name_vi: "Di dời, ngầm hóa hệ thống điện, viễn thông",
                    name_en: "Utility Relocation",
                    level: 2,
                  },
                  {
                    code: "13.9",
                    name_vi:
                      "Xin phép phục vụ thi công (đấu nối giao thông, qua",
                    name_en: "Construction Permits",
                    level: 2,
                  },
                  {
                    code: "13.10",
                    name_vi: "Kiểm định",
                    name_en: "Inspection",
                    level: 2,
                  },
                  {
                    code: "13.11",
                    name_vi: "Đo vẽ, Khảo sát",
                    name_en: "Surveying",
                    level: 2,
                  },
                  {
                    code: "13.99",
                    name_vi: "Hạng mục trước xây dựng khác",
                    name_en: "Other Pre-construction",
                    level: 2,
                  },
                ],
              },
              {
                code: "14",
                name_vi: "HẠ TẦNG KỸ THUẬT",
                name_en: "INFRASTRUCTURE",
                level: 1,
                children: [
                  {
                    code: "14.1",
                    name_vi: "San lấp, nạo vét bùn",
                    name_en: "Land Filling, Dredging",
                    level: 2,
                  },
                  {
                    code: "14.2",
                    name_vi: "Tường chắn",
                    name_en: "Retaining Wall",
                    level: 2,
                  },
                  {
                    code: "14.3",
                    name_vi: "Thi công đê, kè",
                    name_en: "Dike, Embankment Construction",
                    level: 2,
                  },
                  {
                    code: "14.4",
                    name_vi: "Thi công cầu",
                    name_en: "Bridge Construction",
                    level: 2,
                  },
                  {
                    code: "14.5",
                    name_vi: "Hàng rào, cổng chào, bảng hiệu & nhà bảo vệ",
                    name_en: "Fence, Gate, Signage",
                    level: 2,
                  },
                  {
                    code: "14.6",
                    name_vi: "Hạ tầng kỹ thuật giao thông",
                    name_en: "Transportation Infrastructure",
                    level: 2,
                  },
                  {
                    code: "14.7",
                    name_vi:
                      "Hạ tầng đường giao thông, vỉa hè, thoát nước mưa,",
                    name_en: "Roads, Pavements, Drainage",
                    level: 2,
                  },
                  {
                    code: "14.8",
                    name_vi: "Hạ tầng kỹ thuật cơ điện",
                    name_en: "M&E Infrastructure",
                    level: 2,
                  },
                  {
                    code: "14.9",
                    name_vi: "Hạ tầng viễn thông",
                    name_en: "Telecommunication Infrastructure",
                    level: 2,
                  },
                  {
                    code: "14.10",
                    name_vi: "Công nghệ xử lý nước thải",
                    name_en: "Wastewater Treatment",
                    level: 2,
                  },
                  {
                    code: "14.11",
                    name_vi: "Hệ thống camera quan sát & barrier",
                    name_en: "CCTV & Barrier System",
                    level: 2,
                  },
                  {
                    code: "14.99",
                    name_vi: "Hạ tầng kỹ thuật khác",
                    name_en: "Other Infrastructure",
                    level: 2,
                  },
                ],
              },
              {
                code: "15",
                name_vi: "CỌC, TƯỜNG VÂY",
                name_en: "PILING, DIAPHRAGM WALL",
                level: 1,
                children: [
                  {
                    code: "15.1",
                    name_vi: "Cọc, tường vây",
                    name_en: "Piling, Diaphragm Wall",
                    level: 2,
                  },
                  {
                    code: "15.2",
                    name_vi: "Thép cọc, tường vây",
                    name_en: "Steel for Piling",
                    level: 2,
                  },
                  {
                    code: "15.3",
                    name_vi: "Thép Kingpost",
                    name_en: "Kingpost Steel",
                    level: 2,
                  },
                  {
                    code: "15.4",
                    name_vi: "Bê tông cọc, tường vây",
                    name_en: "Concrete for Piling",
                    level: 2,
                  },
                  {
                    code: "15.99",
                    name_vi: "Cọc, tường vây khác",
                    name_en: "Other Piling Works",
                    level: 2,
                  },
                ],
              },
              {
                code: "16",
                name_vi: "KẾT CẤU, HOÀN THIỆN",
                name_en: "STRUCTURE, FINISHING",
                level: 1,
                children: [
                  {
                    code: "16.1",
                    name_vi: "Thi công kết cấu, hoàn thiện",
                    name_en: "Structure & Finishing Works",
                    level: 2,
                  },
                  {
                    code: "16.2",
                    name_vi: "Thép",
                    name_en: "Steel",
                    level: 2,
                  },
                  {
                    code: "16.3",
                    name_vi: "Bê tông",
                    name_en: "Concrete",
                    level: 2,
                  },
                  {
                    code: "16.4",
                    name_vi: "Bảng hiệu",
                    name_en: "Signage",
                    level: 2,
                  },
                  {
                    code: "16.5",
                    name_vi: "Nội thất sảnh chính, tiện ích",
                    name_en: "Lobby & Amenity Furniture",
                    level: 2,
                  },
                  {
                    code: "16.6",
                    name_vi: "Cửa gỗ, cửa sắt, phụ kiện, tủ tường",
                    name_en: "Doors, Accessories, Cabinets",
                    level: 2,
                  },
                  {
                    code: "16.7",
                    name_vi: "Gạch, đá, sàn gỗ",
                    name_en: "Tiles, Stone, Wood Flooring",
                    level: 2,
                  },
                  {
                    code: "16.8",
                    name_vi: "Sàn gỗ",
                    name_en: "Wood Flooring",
                    level: 2,
                  },
                  {
                    code: "16.9",
                    name_vi: "Tủ bếp, thiết bị bếp",
                    name_en: "Kitchen Cabinets & Equipment",
                    level: 2,
                  },
                  {
                    code: "16.10",
                    name_vi: "Thiết bị vệ sinh, máy nước nóng",
                    name_en: "Sanitary Ware, Water Heater",
                    level: 2,
                  },
                  {
                    code: "16.99",
                    name_vi: "Kết cấu, hoàn thiện khác",
                    name_en: "Other Structure & Finishing",
                    level: 2,
                  },
                ],
              },
              {
                code: "17",
                name_vi: "CẢNH QUAN",
                name_en: "LANDSCAPE",
                level: 1,
                children: [
                  {
                    code: "17.1",
                    name_vi: "Cảnh quan mềm, hệ thống tưới",
                    name_en: "Softscape, Irrigation System",
                    level: 2,
                  },
                  {
                    code: "17.2",
                    name_vi: "Hệ thống tưới",
                    name_en: "Irrigation System",
                    level: 2,
                  },
                  {
                    code: "17.3",
                    name_vi: "Cảnh quan cứng",
                    name_en: "Hardscape",
                    level: 2,
                  },
                  {
                    code: "17.4",
                    name_vi: "Thiết bị ngoài trời",
                    name_en: "Outdoor Equipment",
                    level: 2,
                  },
                  {
                    code: "17.99",
                    name_vi: "Cảnh quan khác",
                    name_en: "Other Landscape",
                    level: 2,
                  },
                ],
              },
              {
                code: "18",
                name_vi: "NHÔM KÍNH",
                name_en: "ALUMINIUM & GLASS",
                level: 1,
                children: [
                  {
                    code: "18.1",
                    name_vi: "Nhôm kính, vách kính nhà tắm",
                    name_en: "Aluminum, Glass, Partitions",
                    level: 2,
                  },
                  {
                    code: "18.2",
                    name_vi: "Kim loại",
                    name_en: "Metal Works",
                    level: 2,
                  },
                  {
                    code: "18.99",
                    name_vi: "Nhôm kính khác",
                    name_en: "Other Aluminum & Glass",
                    level: 2,
                  },
                ],
              },
              {
                code: "19",
                name_vi: "CƠ ĐIỆN",
                name_en: "M&E",
                level: 1,
                children: [
                  {
                    code: "19.2",
                    name_vi: "Thi công hệ thống PCCC",
                    name_en: "Fire Fighting System",
                    level: 2,
                  },
                  {
                    code: "19.3",
                    name_vi: "Điều hòa không khí",
                    name_en: "Air Conditioning",
                    level: 2,
                  },
                  {
                    code: "19.4",
                    name_vi: "Đèn, công tắc, ổ cắm",
                    name_en: "Lighting, Switches, Sockets",
                    level: 2,
                  },
                  {
                    code: "19.5",
                    name_vi: "Máy phát điện",
                    name_en: "Generator",
                    level: 2,
                  },
                  {
                    code: "19.6",
                    name_vi: "Hệ thống intercom",
                    name_en: "Intercom System",
                    level: 2,
                  },
                  {
                    code: "19.7",
                    name_vi: "Đèn cảnh quan và mặt dựng",
                    name_en: "Landscape & Facade Lighting",
                    level: 2,
                  },
                  {
                    code: "19.8",
                    name_vi: "Hệ thống car parking",
                    name_en: "Car Parking System",
                    level: 2,
                  },
                  {
                    code: "19.9",
                    name_vi: "Thang máy, thang cuốn",
                    name_en: "Elevator, Escalator",
                    level: 2,
                  },
                  {
                    code: "19.99",
                    name_vi: "Cơ điện khác",
                    name_en: "Other M&E",
                    level: 2,
                  },
                ],
              },
              {
                code: "20",
                name_vi: "HẠNG MỤC ĐẶC BIỆT",
                name_en: "SPECIAL CATEGORIES",
                level: 1,
                children: [
                  {
                    code: "20.1",
                    name_vi: "BMS",
                    name_en: "BMS",
                    level: 2,
                  },
                  {
                    code: "20.2",
                    name_vi: "Smart home",
                    name_en: "Smart Home",
                    level: 2,
                  },
                  {
                    code: "20.3",
                    name_vi: "FF&E",
                    name_en: "FF&E",
                    level: 2,
                  },
                  {
                    code: "20.4",
                    name_vi: "OSE, EQT",
                    name_en: "OSE, EQT",
                    level: 2,
                  },
                  {
                    code: "20.5",
                    name_vi: "Car stucker",
                    name_en: "Car Stacker",
                    level: 2,
                  },
                  {
                    code: "20.6",
                    name_vi: "Công nghệ hồ bơi",
                    name_en: "Swimming Pool Technology",
                    level: 2,
                  },
                  {
                    code: "20.7",
                    name_vi: "Smart City",
                    name_en: "Smart City",
                    level: 2,
                  },
                  {
                    code: "20.8",
                    name_vi: "Phương tiện di chuyển, vận chuyển",
                    name_en: "Transportation",
                    level: 2,
                  },
                  {
                    code: "20.99",
                    name_vi: "Trang thiết bị khác",
                    name_en: "Other Equipment",
                    level: 2,
                  },
                ],
              },
              {
                code: "21",
                name_vi: "TƯ VẤN THIẾT KẾ",
                name_en: "DESIGN CONSULTANCY",
                level: 1,
                children: [
                  {
                    code: "21.1",
                    name_vi: "Tư vấn quy hoạch",
                    name_en: "Planning Consultancy",
                    level: 2,
                  },
                  {
                    code: "21.2",
                    name_vi: "Tư vấn thiết kế kiến trúc",
                    name_en: "Architectural Design",
                    level: 2,
                  },
                  {
                    code: "21.3",
                    name_vi: "Tư vấn thiết kế kết cấu",
                    name_en: "Structural Design",
                    level: 2,
                  },
                  {
                    code: "21.4",
                    name_vi: "Tư vấn thiết kế cơ điện",
                    name_en: "M&E Design",
                    level: 2,
                  },
                  {
                    code: "21.5",
                    name_vi: "Tư vấn thiết kế hạ tầng",
                    name_en: "Infrastructure Design",
                    level: 2,
                  },
                  {
                    code: "21.6",
                    name_vi: "Tư vấn thiết kế cảnh quan",
                    name_en: "Landscape Design",
                    level: 2,
                  },
                  {
                    code: "21.7",
                    name_vi: "Tư vấn thiết kế nội thất",
                    name_en: "Interior Design",
                    level: 2,
                  },
                  {
                    code: "21.8",
                    name_vi: "Tư vấn thẩm tra, thẩm duyệt thiết kế",
                    name_en: "Design Verification",
                    level: 2,
                  },
                  {
                    code: "21.9",
                    name_vi: "Tư vấn thẩm tra, thẩm duyệt PCCC",
                    name_en: "Fire Safety Verification",
                    level: 2,
                  },
                  {
                    code: "21.10",
                    name_vi:
                      "Tư vấn lập báo cáo đánh giá tác động môi trường",
                    name_en: "EIA Consultancy",
                    level: 2,
                  },
                  {
                    code: "21.11",
                    name_vi: "Tư vấn thiết kế chiếu sáng (Lighting design)",
                    name_en: "Lighting Design",
                    level: 2,
                  },
                  {
                    code: "21.12",
                    name_vi: "Tư vấn hệ thống IT/AV",
                    name_en: "IT/AV Consultancy",
                    level: 2,
                  },
                  {
                    code: "21.13",
                    name_vi: "Tư vấn hệ thống bếp & Giặt ủi",
                    name_en: "Kitchen & Laundry Consultancy",
                    level: 2,
                  },
                  {
                    code: "21.14",
                    name_vi: "Tư vấn thiết kế 3 bộ môn",
                    name_en: "3-Discipline Design",
                    level: 2,
                  },
                  {
                    code: "21.15",
                    name_vi: "Tư vấn vận hành khách sạn",
                    name_en: "Hotel Operation Consultancy",
                    level: 2,
                  },
                  {
                    code: "21.99",
                    name_vi: "Tư vấn thiết kế khác",
                    name_en: "Other Design Consultancy",
                    level: 2,
                  },
                ],
              },
              {
                code: "22",
                name_vi: "TƯ VẤN GIÁM SÁT VÀ QUẢN LÝ DỰ ÁN",
                name_en: "SUPERVISION & PM",
                level: 1,
                children: [
                  {
                    code: "22.1",
                    name_vi: "Tư vấn quản lý dự án",
                    name_en: "Project Management",
                    level: 2,
                  },
                  {
                    code: "22.2",
                    name_vi: "Tư vấn giám sát dự án",
                    name_en: "Project Supervision",
                    level: 2,
                  },
                  {
                    code: "22.3",
                    name_vi: "Chi phí hoạt động dự án (ADM)",
                    name_en: "Project Admin Cost (ADM)",
                    level: 2,
                  },
                  {
                    code: "22.4",
                    name_vi: "Chi phí bảo hành (PDC)",
                    name_en: "Warranty Cost (PDC)",
                    level: 2,
                  },
                  {
                    code: "22.5",
                    name_vi: "Khảo sát & Chứng nhận chất lượng",
                    name_en: "Survey & Quality Certification",
                    level: 2,
                  },
                  {
                    code: "22.6",
                    name_vi: "Tư vấn khối lượng (QS)",
                    name_en: "Quantity Surveying (QS)",
                    level: 2,
                  },
                  {
                    code: "22.7",
                    name_vi: "Đo vẽ cấp sổ cho dự án",
                    name_en: "Survey for Land Title",
                    level: 2,
                  },
                  {
                    code: "22.99",
                    name_vi: "Tư vấn giám sát dự án và quản lý dự án khác",
                    name_en: "Other Supervision & PM",
                    level: 2,
                  },
                ],
              },
              {
                code: "23",
                name_vi: "MARKETING",
                name_en: "MARKETING",
                level: 1,
                children: [
                  {
                    code: "23.1",
                    name_vi:
                      "Nhà mẫu dự án (Show Flat, Sale Gallary, Show Unit…",
                    name_en: "Show Flat, Sales Gallery...",
                    level: 2,
                  },
                  {
                    code: "23.2",
                    name_vi: "Tài liệu bán hàng",
                    name_en: "Sales Materials",
                    level: 2,
                  },
                  {
                    code: "23.3",
                    name_vi: "Branding",
                    name_en: "Branding",
                    level: 2,
                  },
                  {
                    code: "23.4",
                    name_vi: "Tài liệu Marketting",
                    name_en: "Marketing Materials",
                    level: 2,
                  },
                  {
                    code: "23.5",
                    name_vi: "Truyền thông",
                    name_en: "Communication",
                    level: 2,
                  },
                  {
                    code: "23.6",
                    name_vi: "Sự kiện",
                    name_en: "Events",
                    level: 2,
                  },
                  {
                    code: "23.99",
                    name_vi: "Marketing khác",
                    name_en: "Other Marketing",
                    level: 2,
                  },
                ],
              },
              {
                code: "24",
                name_vi: "CHI PHÍ TÀI CHÍNH & VỐN HÓA",
                name_en: "FINANCIAL & CAPITALIZED COST",
                level: 1,
                children: [
                  {
                    code: "24.1",
                    name_vi: "Lãi vay vốn hóa",
                    name_en: "Capitalized Interest",
                    level: 2,
                  },
                  {
                    code: "24.2",
                    name_vi: "Lãi tiết kiệm/cho vay thu được",
                    name_en: "Interest Income",
                    level: 2,
                  },
                ],
              },
              {
                code: "25",
                name_vi: "CÔNG TRÌNH TIỆN ÍCH",
                name_en: "AMENITIES",
                level: 1,
                children: [
                  {
                    code: "25.1",
                    name_vi: "Hồ điều tiết, hồ cảnh quan",
                    name_en: "Regulating Lake, Landscape Lake",
                    level: 2,
                  },
                  {
                    code: "25.2",
                    name_vi: "Hồ bơi",
                    name_en: "Swimming Pool",
                    level: 2,
                  },
                  {
                    code: "25.3",
                    name_vi: "Khu vui chơi giải trí",
                    name_en: "Amusement Park",
                    level: 2,
                  },
                  {
                    code: "25.4",
                    name_vi: "Khu thể thao ngoài trời",
                    name_en: "Outdoor Sports Area",
                    level: 2,
                  },
                  {
                    code: "25.5",
                    name_vi: "Sân Golf",
                    name_en: "Golf Course",
                    level: 2,
                  },
                  {
                    code: "25.6",
                    name_vi: "Bến (tàu, thuyền…)",
                    name_en: "Marina",
                    level: 2,
                  },
                  {
                    code: "25.7",
                    name_vi: "Safari",
                    name_en: "Safari",
                    level: 2,
                  },
                  {
                    code: "25.8",
                    name_vi: "Sân vận động",
                    name_en: "Stadium",
                    level: 2,
                  },
                  {
                    code: "25.9",
                    name_vi: "Clubhouse",
                    name_en: "Clubhouse",
                    level: 2,
                  },
                  {
                    code: "25.10",
                    name_vi: "Welcome center",
                    name_en: "Welcome Center",
                    level: 2,
                  },
                  {
                    code: "25.11",
                    name_vi: "Nhà hội nghị",
                    name_en: "Convention Center",
                    level: 2,
                  },
                  {
                    code: "25.12",
                    name_vi: "BOH",
                    name_en: "BOH",
                    level: 2,
                  },
                  {
                    code: "25.13",
                    name_vi: "Hồ cấp nước dự án",
                    name_en: "Project Reservoir",
                    level: 2,
                  },
                  {
                    code: "25.14",
                    name_vi:
                      "Nhà máy khai thác nước ngầm/ nước mặt và đường ống",
                    name_en: "Water Plant & Pipelines",
                    level: 2,
                  },
                  {
                    code: "25.15",
                    name_vi: "Công trình tiện ích phụ trợ",
                    name_en: "Auxiliary Amenities",
                    level: 2,
                  },
                  {
                    code: "25.16",
                    name_vi: "Sport Center",
                    name_en: "Sport Center",
                    level: 2,
                  },
                ],
              },
              {
                code: "26",
                name_vi: "CHI PHÍ TIỀN KHAI TRƯƠNG",
                name_en: "PRE-OPENING COST",
                level: 1,
                children: [
                  {
                    code: "26.1",
                    name_vi: "Nhân sự và admin",
                    name_en: "HR & Admin",
                    level: 2,
                  },
                  {
                    code: "26.2",
                    name_vi: "CP hàng cung ứng vận hành",
                    name_en: "Operational Supplies",
                    level: 2,
                  },
                  {
                    code: "26.3",
                    name_vi: "CP năng lượng tiền khai trương",
                    name_en: "Pre-opening Energy Cost",
                    level: 2,
                  },
                  {
                    code: "26.4",
                    name_vi: "Công nghệ thông tin",
                    name_en: "Information Technology",
                    level: 2,
                  },
                  {
                    code: "26.5",
                    name_vi: "Trang thiết bị vận hành",
                    name_en: "Operational Equipment",
                    level: 2,
                  },
                  {
                    code: "26.6",
                    name_vi: "Trang thiết bị F&B",
                    name_en: "F&B Equipment",
                    level: 2,
                  },
                  {
                    code: "26.7",
                    name_vi: "Marketing tiền khai trương",
                    name_en: "Pre-opening Marketing",
                    level: 2,
                  },
                  {
                    code: "26.99",
                    name_vi: "Tiền khai trương khác",
                    name_en: "Other Pre-opening",
                    level: 2,
                  },
                ],
              },
              {
                code: "93",
                name_vi: "CHI PHÍ TÀI TRỢ DỰ ÁN",
                name_en: "PROJECT SPONSORSHIP COST",
                level: 1,
                children: [],
              },
              {
                code: "94",
                name_vi: "CHI PHÍ PHÁP LÝ DỰ ÁN",
                name_en: "PROJECT LEGAL COST",
                level: 1,
                children: [
                  {
                    code: "94.1",
                    name_vi:
                      "Chi phí liên quan đến đất (thủ tục pháp lý, thẩm định giá đất, )",
                    name_en: "Land-related Legal Fees",
                    level: 2,
                  },
                  {
                    code: "94.2",
                    name_vi:
                      "Chi phí liên quan thủ tục xin phép (phê duyệt 1/500; 1/2000; 1/5000…)",
                    name_en: "Permit Application Fees",
                    level: 2,
                  },
                  {
                    code: "94.3",
                    name_vi: "Hợp đồng tư vấn pháp lý",
                    name_en: "Legal Consultancy Contracts",
                    level: 2,
                  },
                ],
              },
              {
                code: "95",
                name_vi: "CHI PHÍ HOẠT ĐỘNG CHUNG DỰ ÁN",
                name_en: "GENERAL PROJECT OPERATING COST",
                level: 1,
                children: [
                  {
                    code: "95.1",
                    name_vi: "Phí điện, nước, điện thoại, internet",
                    name_en: "Utilities Fee",
                    level: 2,
                  },
                  {
                    code: "95.2",
                    name_vi:
                      "Phí & lệ phí (thuế đất, thuế đất PNN, phí, lệ phí trước bạ, thuế nhập khẩu…)",
                    name_en: "Taxes & Fees",
                    level: 2,
                  },
                  {
                    code: "95.3",
                    name_vi: "Chi phí ủng hộ, mua quà, … đưa vào dự án",
                    name_en: "Donations, Gifts...",
                    level: 2,
                  },
                  {
                    code: "95.4",
                    name_vi: "Chi phí liên quan đến bàn giao nhà",
                    name_en: "Handover Costs",
                    level: 2,
                  },
                  {
                    code: "95.5",
                    name_vi: "Chi phí linh tinh khác thuộc dự án",
                    name_en: "Other Miscellaneous Costs",
                    level: 2,
                  },
                ],
              },
              {
                code: "96",
                name_vi: "CHI PHÍ BẢO HÀNH, BẢO TRÌ",
                name_en: "WARRANTY & MAINTENANCE COST",
                level: 1,
                children: [],
              },
              {
                code: "97",
                name_vi: "CHI PHÍ VẬN HÀNH BÙ LỖ THỜI GIAN ĐẦU",
                name_en: "INITIAL OPERATING LOSS",
                level: 1,
                children: [],
              },
              {
                code: "98",
                name_vi: "PHÍ TƯ VẤN & THIẾT KẾ KHÁC",
                name_en: "OTHER CONSULTANCY & DESIGN FEES",
                level: 1,
                children: [
                  {
                    code: "98.1",
                    name_vi: "Tư vấn phiên biện dự án",
                    name_en: "Project Defense Consultancy",
                    level: 2,
                  },
                  {
                    code: "98.2",
                    name_vi: "Tư vấn nội bộ",
                    name_en: "Internal Consultancy",
                    level: 2,
                  },
                  {
                    code: "98.3",
                    name_vi: "Phí tư vấn khác",
                    name_en: "Other Consultancy Fees",
                    level: 2,
                  },
                ],
              },
              {
                code: "99",
                name_vi: "CHI PHÍ CHƯA XÁC ĐỊNH",
                name_en: "UNIDENTIFIED COST",
                level: 1,
                children: [
                  {
                    code: "99.99",
                    name_vi: "Chi phí dự phòng",
                    name_en: "Contingency Cost",
                    level: 2,
                  },
                ],
              },
            ];

          const { seeded, seededCount } = await seedCategoriesIfEmpty(
            databaseService,
            defaultReportStructure
          );
          if (seeded) {
            console.log(`Seeded ${seededCount} categories successfully.`);
          } else {
            console.log(
              "Categories table already populated. Skipping seed."
            );
          }
        } catch (error) {
          console.error("Failed to seed initial categories:", error);
        }
      },
      _recalculateAllDetailRowsAfterLoad() {
        const allContractIds = Array.from(new Set(this.contracts.map((c) => c.id)));
        if (allContractIds.length === 0) return;

        const allRecalculatedRows = [];
        const contractMap = this.contractMap;

        // Sử dụng kỹ thuật xử lý không chặn luồng (Non-blocking loop)
        let index = 0;
        const processNextContract = () => {
          if (index < allContractIds.length) {
            const contractId = allContractIds[index];
            const contract = contractMap.get(contractId);
            let tableData = this.cpcDetailRows
              .filter((row) => row.contractId === contractId)
              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

            if (tableData.length > 0 && contract) {
              // Sync thanh toán và tính toán lại
              this.syncPaymentsToDetails(contractId, null, tableData);
              const recalculated = this.runCalculationEngine(tableData, contract);
              allRecalculatedRows.push(...recalculated);
            }

            index++;
            // Cứ sau mỗi hợp đồng, trả lại quyền điều khiển cho trình duyệt 1ms để tránh treo UI
            setTimeout(processNextContract, 1);
          } else {
            // Khi đã tính xong tất cả
            const orphanRows = this.cpcDetailRows.filter(
              (row) => !new Set(allContractIds).has(row.contractId)
            );
            this.cpcDetailRows = [...allRecalculatedRows, ...orphanRows];
            console.log(
              `Global recalculation finished. Processed rows for ${allContractIds.size} contracts.`
            );
          }
        };

        processNextContract();
      },

      async navigateDetailModal(direction) {
        const saveSuccess = await this.saveContractDetails(false);
        if (!saveSuccess) {
          this.showToast("Lỗi khi lưu, không thể di chuyển.", "error");
          return;
        }

        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        const currentTable = this.cpcDetailRows
          .filter((r) => r.contractId === contractId)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        let nextIndex;
        if (direction === "next") {
          nextIndex = this.currentDetailIndex + 1;
        } else {
          nextIndex = this.currentDetailIndex - 1;
        }

        if (nextIndex >= 0 && nextIndex < currentTable.length) {
          const nextItem = currentTable[nextIndex];
          this.openContractDetailsModal(nextItem, nextIndex);
        } else {
          this.showToast(
            direction === "next"
              ? "Đã ở dòng cuối cùng."
              : "Đã ở dòng đầu tiên.",
            "info",
            2000
          );
        }
      },

      handleCpcSendClick(event, item) {
        if (event.ctrlKey || event.metaKey) {
          this.sendAllCpcsForContract();
        } else {
          this.sendCpcToTracking(item);
        }
      },

      async sendAllCpcsForContract() {
        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        const contractInfo = this.selectedContractDetails;

        if (!contractId || !contractInfo) {
          this.showToast(this.t("errorSelectContractAction"), "warning");
          return;
        }

        const allRowsForContract = this.cpcDetailRows.filter(
          (row) => row.contractId === contractId && row.cpcNo
        );

        if (allRowsForContract.length === 0) {
          this.showToast(this.t("infoNoCpcToSend"), "info");
          return;
        }

        const groupedByCpc = allRowsForContract.reduce((acc, row) => {
          if (!acc[row.cpcNo]) {
            acc[row.cpcNo] = [];
          }
          acc[row.cpcNo].push(row);
          return acc;
        }, {});

        const cpcKeys = Object.keys(groupedByCpc);

        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmBulkSendTitle"),
          message: this.t("confirmBulkSendMessage", {
            count: cpcKeys.length,
            contractNo: contractInfo.contractNo,
          }),
          confirmButtonText: this.t("btnConfirmSendAll"),
          confirmButtonClass: "btn-primary",
          onConfirm: async () => {
            try {
              let cpcsToAdd = [];
              let cpcsToUpdate = [];
              let allUpdatedDetailRows = [];

              for (const cpcNo of cpcKeys) {
                const rows = groupedByCpc[cpcNo];
                const aggregatedData = this._aggregateCpcDataFromDetailRows(
                  rows,
                  contractInfo.currency === "USD"
                );

                const existingCpc = this.cpcItems.find(
                  (c) =>
                    c.contractId === contractId && c.cpcIdentifier === cpcNo
                );

                if (existingCpc) {
                  const cpcToUpdate = { ...existingCpc };
                  if (contractInfo.currency === "USD") {
                    cpcToUpdate.amountUsd = aggregatedData.amountDue;
                  } else {
                    cpcToUpdate.amountExclVAT = aggregatedData.amountDue;
                    cpcToUpdate.vatAmount = aggregatedData.vatAmount;
                    cpcToUpdate.amount = aggregatedData.finalAmount;
                  }
                  if (aggregatedData.finalContents)
                    cpcToUpdate.contents = aggregatedData.finalContents;
                  if (aggregatedData.paymentDueDate)
                    cpcToUpdate.paymentDueDate =
                      aggregatedData.paymentDueDate;

                  cpcsToUpdate.push(cpcToUpdate);
                  rows.forEach((row) => (row.linkedCpcId = cpcToUpdate.id));
                } else {
                  const cpcToAdd = {
                    contractId: contractInfo.id,
                    cpcIdentifier: cpcNo,
                    contents: aggregatedData.finalContents,
                    amount:
                      contractInfo.currency === "USD"
                        ? 0
                        : aggregatedData.finalAmount,
                    amountExclVAT:
                      contractInfo.currency === "USD"
                        ? 0
                        : aggregatedData.amountDue,
                    vatAmount: aggregatedData.vatAmount,
                    amountUsd:
                      contractInfo.currency === "USD"
                        ? aggregatedData.amountDue
                        : 0,
                    exchangeRate: 0,
                    receivedDate: "",
                    paymentDueDate: aggregatedData.paymentDueDate,

                    projectId: contractInfo.projectId,
                    vendorId: contractInfo.vendorId,
                    code: contractInfo.code,
                    department: contractInfo.department,
                    contractSystemNo: contractInfo.contractSystemNo,

                    lineTracking: "",
                    notes: "",
                    isExpanded: false,
                  };
                  cpcsToAdd.push(cpcToAdd);
                }
                allUpdatedDetailRows.push(...rows);
              }

              const persisted = await upsertCpcsAndSyncDetailLinks(
                databaseService,
                cpcsToUpdate,
                cpcsToAdd,
                allUpdatedDetailRows
              );
              cpcsToUpdate = persisted.cpcsToUpdate;
              cpcsToAdd = persisted.cpcsToAdd;
              allUpdatedDetailRows = persisted.allUpdatedDetailRows;

              cpcsToUpdate.forEach((updatedCpc) => {
                const index = this.cpcItems.findIndex(
                  (c) => c.id === updatedCpc.id
                );
                if (index > -1) this.cpcItems[index] = updatedCpc;
              });
              this.cpcItems.unshift(...cpcsToAdd);

              allUpdatedDetailRows.forEach((updatedRow) => {
                const index = this.cpcDetailRows.findIndex(
                  (r) => r.id === updatedRow.id
                );
                if (index > -1) this.cpcDetailRows[index] = updatedRow;
              });

              this.showToast(
                this.t("successBulkCpcSent", { count: cpcKeys.length }),
                "success"
              );
            } catch (error) {
              console.error("Lỗi khi gửi hàng loạt CPC:", error);
              this.showToast(this.t("errorBulkCpcFailed"), "error");
            }
          },
        });
      },

      _aggregateCpcDataFromDetailRows(rows, isUsdContract) {
        const aggregated = rows.reduce(
          (acc, row) => {
            acc.amountDue += row.cpcAmountDue || 0;
            acc.vatAmount += isUsdContract ? 0 : row.cpcVat || 0;
            if (row.description) {
              acc.descriptions.add(row.description);
            }
            if (
              row.cpcDueDate &&
              (!acc.paymentDueDate || row.cpcDueDate < acc.paymentDueDate)
            ) {
              acc.paymentDueDate = row.cpcDueDate;
            }
            return acc;
          },
          {
            amountDue: 0,
            vatAmount: 0,
            descriptions: new Set(),
            paymentDueDate: null,
          }
        );
        aggregated.finalContents = Array.from(aggregated.descriptions).join(
          "; "
        );
        aggregated.finalAmount =
          aggregated.amountDue + aggregated.vatAmount;
        return aggregated;
      },

      openProjectModal(mode = "add", project = null) {
        this.projectModalMode = mode;
        if (mode === "add") {
          this.currentEditProject = { name: "" };
        } else {
          this.currentEditProject = JSON.parse(JSON.stringify(project));
        }
        appUtils.ui.toggleModal("projectManagementModal", "show");
      },

      closeProjectModal() {
        appUtils.ui.toggleModal("projectManagementModal", "hide");
        this.currentEditProject = null;
      },

      async saveProject() {
        if (!this.requirePermission("masterdata.manage")) return;
        if (
          !this.currentEditProject ||
          !this.currentEditProject.name.trim()
        ) {
          this.showToast(this.t("errorProjectNameRequired"), "error");
          return;
        }

        const name = this.currentEditProject.name.trim();

        const isDuplicate = this.projects.some(
          (p) =>
            p.name.toLowerCase() === name.toLowerCase() &&
            p.id !== this.currentEditProject.id
        );

        if (isDuplicate) {
          this.showToast(
            this.t("errorProjectNameExists", { name: name }),
            "error"
          );
          return;
        }

        const projectToSave = JSON.parse(
          JSON.stringify(this.currentEditProject)
        );

        try {
          const savedProject = await saveProjectRecord(
            databaseService,
            projectToSave,
            this.projectModalMode
          );
          if (this.projectModalMode === "add") {
            projectToSave.id = savedProject.id;
            this.projects.push(projectToSave);
            this.showToast(this.t("projectAddSuccess"), "success");
          } else {
            const index = this.projects.findIndex(
              (p) => p.id === projectToSave.id
            );
            if (index !== -1) {
              this.projects[index] = projectToSave;
            }
            this.showToast(this.t("projectUpdateSuccess"), "success");
          }

          this.closeProjectModal();
        } catch (error) {
          console.error("Lỗi khi lưu dự án:", error);
          this.showToast(this.t("projectSaveError"), "error");
        }
      },

      triggerReactivity() {
        this.dataVersion++;
        console.log(
          `Data version incremented to: ${this.dataVersion}. Forcing UI update.`
        );
      },

      handlePaginationShortcut(event) {
        if (
          event.altKey &&
          (event.key === "ArrowRight" || event.key === "ArrowLeft")
        ) {
          event.preventDefault();

          let state = null;
          let totalPages = 1;

          switch (this.currentTab) {
            case "cpc-tracking":
              state = this.viewStates.cpcTracking;
              totalPages = this.totalPages;
              break;
            case "cpc-dashboard":
              state = this.viewStates.paymentDashboard;
              totalPages = this.dashboardTotalPages;
              break;
            case "cpc-swap-dashboard":
              state = this.viewStates.swapDashboard;
              totalPages = this.swapDashboardTotalPages;
              break;
            case "cpc-bond-dashboard":
              state = this.viewStates.bondDashboard;
              totalPages = this.bondDashboardTotalPages;
              break;
            case "cpc-contract-dashboard":
              state = this.viewStates.contractDashboard;
              totalPages = this.contractDashboardTotalPages;
              break;
            case "vendor-balance":
              state = this.viewStates.vendorBalance;
              totalPages = this.vendorBalanceTotalPages;
              break;
            case "cogs-dashboard":
              state = this.viewStates.cogsDashboard;
              totalPages = this.cogsDashboardTotalPages;
              break;
            case "master-data":
              if (this.masterData.activeSubTab === "vendors") {
                state = this.masterData.vendors;
                totalPages = this.vendorTotalPages;
              } else if (this.masterData.activeSubTab === "projects") {
                state = this.masterData.projects;
                totalPages = this.projectTotalPages;
              }
              break;
          }

          if (state) {
            if (
              event.key === "ArrowRight" &&
              state.currentPage < totalPages
            ) {
              state.currentPage++;
            } else if (event.key === "ArrowLeft" && state.currentPage > 1) {
              state.currentPage--;
            }
          }
        }
      },

      handleFilterToggleShortcut: function (event) {
        if (event.altKey && event.key.toLowerCase() === "f") {
          event.preventDefault();

          let targetState = null;
          switch (this.currentTab) {
            case "cpc-tracking":
              targetState = this.viewStates.cpcTracking;
              break;
            case "cpc-details":
              targetState = this.viewStates.cpcDetails;
              break;
            case "vendor-balance":
              targetState = this.viewStates.vendorBalance;
              break;
            case "cpc-dashboard":
              targetState = this.viewStates.paymentDashboard;
              break;
            case "cpc-swap-dashboard":
              targetState = this.viewStates.swapDashboard;
              break;
            case "cpc-bond-dashboard":
              targetState = this.viewStates.bondDashboard;
              break;
            case "cpc-contract-dashboard":
              targetState = this.viewStates.contractDashboard;
              break;
            case "cogs-dashboard":
              targetState = this.viewStates.cogsDashboard;
              break;
          }

          if (targetState) {
            this.toggleFilterPanel(targetState);
          }
        }
      },

      toggleNotificationDropdown() {
        const bellButton = this.$refs.notificationBellButton;
        if (bellButton) {
          const dropdownInstance =
            bootstrap.Dropdown.getOrCreateInstance(bellButton);
          dropdownInstance.toggle();
        }
      },
      toggleProjectQuickFilter(forceState = null) {
        this.isProjectQuickFilterVisible =
          forceState !== null
            ? forceState
            : !this.isProjectQuickFilterVisible;

        if (this.isProjectQuickFilterVisible) {
          this.projectQuickFilterSearch = "";
          this.activeProjectQuickFilterIndex = 0;
          this.$nextTick(() => {
            this.$refs.projectQuickFilterInput?.focus();
          });
        }
      },

      navigateProjectQuickFilter(direction) {
        const itemCount = this.filteredProjectsForQuickFilter.length;
        if (itemCount === 0) return;

        if (direction === "down") {
          this.activeProjectQuickFilterIndex =
            (this.activeProjectQuickFilterIndex + 1) % itemCount;
        } else if (direction === "up") {
          this.activeProjectQuickFilterIndex =
            (this.activeProjectQuickFilterIndex - 1 + itemCount) %
            itemCount;
        }

        this.$nextTick(() => {
          const list = this.$refs.projectQuickFilterInput
            ?.closest(".command-palette-dialog")
            ?.querySelector(".command-results-list");
          const activeItem = list?.querySelector(
            ".command-result-item.active"
          );

          if (activeItem) {
            activeItem.scrollIntoView({
              block: "nearest",
            });
          }
        });
      },

      toggleProjectSelection(project) {
        if (!project) return;

        const filter = this.viewStates.cpcTracking.filter;

        if (project.id === "all") {
          filter.projectId = [];
          return;
        }

        const index = filter.projectId.indexOf(project.id);

        if (index > -1) {
          filter.projectId.splice(index, 1);
        } else {
          filter.projectId.push(project.id);
        }
      },
      validateDates(item, dateFields) {
        if (!item) return true;

        for (const field of dateFields) {
          const dateStr = item[field];
          if (dateStr && !appUtils.validation.isValidDateString(dateStr)) {
            const fieldLabel = this.t(field.toLowerCase()) || field;
            this.showToast(
              this.t("errorDateInvalidField", {
                dateStr: dateStr,
                field: this.t(field.toLowerCase()) || field,
              }),
              "error",
              6000
            );
            return false;
          }
        }

        if (item.installments && item.installments.length > 0) {
          for (const inst of item.installments) {
            if (
              (inst.date &&
                !appUtils.validation.isValidDateString(inst.date)) ||
              (inst.swapDueDatePayment &&
                !appUtils.validation.isValidDateString(
                  inst.swapDueDatePayment
                ))
            ) {
              this.showToast(
                this.t("errorDateInvalidInstallment"),
                "error",
                6000
              );
              return false;
            }
          }
        }

        return true;
      },

      updateNotesContent(event) {
        this.currentNotesContent = event.target.innerHTML;
      },

      async runFullResync() {
        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmResyncTitle"),
          message: this.t("confirmResyncMessage"),
          confirmButtonClass: "btn-info",
          confirmButtonText: this.t("btnStart"),
          onConfirm: async () => {
            this.showToast(this.t("resyncStarted"), "info", 10000);
            try {
              const updatedCount =
                await databaseService.resyncAllDenormalizedData();
              const freshData = await databaseService.getAllData();
              this._loadState(freshData);
              this.showToast(
                this.t("resyncComplete", { count: updatedCount }),
                "success"
              );
            } catch (error) {
              console.error("Lỗi khi đồng bộ hóa:", error);
              this.showToast(this.t("resyncError"), "error");
            }
          },
        });
      },

      downloadBondTemplate() {
        const bondHeaders = [
          "contractNo",
          "bondNumber",
          "ref",
          "bondType",
          "amount",
          "issueDate",
          "expiryDate",
          "issuingBank",
          "renewedFromBondNumber",
        ];

        const ws = XLSX.utils.json_to_sheet([], { header: bondHeaders });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bonds");
        XLSX.writeFile(wb, "bonds_template.xlsx");
      },

      triggerBondFileUpload() {
        this.$refs.uploadBondExcelInput.click();
      },

      async handleBondFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), {
              type: "array",
              cellDates: true,
            });
            const sheet =
              workbook.Sheets["Bonds"] ||
              workbook.Sheets[workbook.SheetNames[0]];

            if (!sheet) {
              this.showToast(
                this.t("errorSheetNotFound", { sheetName: "Bonds" }),
                "error"
              );
              return;
            }
            const rows = XLSX.utils.sheet_to_json(sheet, {
              raw: false,
              defval: null,
            });

            const newBondsFromFile = [];
            const skippedInfo = [];
            let skippedCount = 0;
            const existingBondNumbers = new Set(
              this.bonds.map((b) => b.bondNumber)
            );
            const newBondNumbersInFile = new Set();

            for (const row of rows) {
              const contractNo = row.contractNo?.trim();
              const bondNumber = row.bondNumber?.trim();

              if (!contractNo || !bondNumber) {
                skippedCount++;
                skippedInfo.push({
                  ...row,
                  reason: this.t("bondUploadReasonMissingData"),
                });
                continue;
              }

              if (
                existingBondNumbers.has(bondNumber) ||
                newBondNumbersInFile.has(bondNumber)
              ) {
                skippedCount++;
                skippedInfo.push({
                  ...row,
                  reason: this.t("bondUploadReasonExists"),
                });
                continue;
              }

              const contract = this.contracts.find(
                (c) =>
                  c.contractNo.trim().toLowerCase() ===
                  contractNo.toLowerCase()
              );
              if (!contract) {
                skippedCount++;
                skippedInfo.push({
                  ...row,
                  reason: this.t("bondUploadReasonNoContract", {
                    contractNo,
                  }),
                });
                continue;
              }

              newBondsFromFile.push({
                contractId: contract.id,
                bondNumber: bondNumber,
                ref: row.ref || "",
                bondType: row.bondType || "",
                amount: parseFloat(row.amount) || 0,
                issueDate: row.issueDate
                  ? appUtils.format.date(new Date(row.issueDate))
                  : "",
                expiryDate: row.expiryDate
                  ? appUtils.format.date(new Date(row.expiryDate))
                  : "",
                issuingBank: row.issuingBank || "",
                isSettled: false,
                isRenewed: false,
                settlementReasonDisplay: "",
                renewedFromBondNumber:
                  row.renewedFromBondNumber?.trim() || null,
              });
              newBondNumbersInFile.add(bondNumber);
            }

            const dbBondsToUpdate = new Map();
            const newBondsMap = new Map(
              newBondsFromFile.map((b) => [b.bondNumber, b])
            );

            for (const newBond of newBondsFromFile) {
              if (newBond.renewedFromBondNumber) {
                const originalBondNumber = newBond.renewedFromBondNumber;

                if (newBondsMap.has(originalBondNumber)) {
                  const originalBondInFile =
                    newBondsMap.get(originalBondNumber);
                  originalBondInFile.isRenewed = true;
                  originalBondInFile.isSettled = true;
                  originalBondInFile.settlementReasonDisplay =
                    this.t("renewedStatus");
                } else {
                  const originalBondInDb = this.bonds.find(
                    (b) => b.bondNumber === originalBondNumber
                  );
                  if (originalBondInDb) {
                    const updatedOriginal = JSON.parse(
                      JSON.stringify(originalBondInDb)
                    );
                    updatedOriginal.isRenewed = true;
                    updatedOriginal.isSettled = true;
                    updatedOriginal.settlementReasonDisplay =
                      this.t("renewedStatus");
                    dbBondsToUpdate.set(
                      updatedOriginal.id,
                      updatedOriginal
                    );
                  }
                }
              }
            }

            const bondsToAdd = Array.from(newBondsMap.values());
            const bondsToUpdate = Array.from(dbBondsToUpdate.values());

            if (bondsToAdd.length > 0 || bondsToUpdate.length > 0) {
              await applyBondUploadChanges(
                databaseService,
                bondsToAdd,
                bondsToUpdate
              );

              const freshData = await databaseService.getAllData();
              this._loadState(freshData);
            }

            let message =
              bondsToAdd.length > 0
                ? this.t("bondUploadSuccess", { count: bondsToAdd.length })
                : this.t("bondUploadNone");
            if (skippedCount > 0) {
              message += this.t("bondUploadSkipped", {
                count: skippedCount,
              });
              console.warn(this.t("bondUploadSkippedConsole"), skippedInfo);
            }

            this.showToast(
              message,
              bondsToAdd.length > 0 ? "success" : "info"
            );
          } catch (error) {
            console.error("Lỗi xử lý file bảo lãnh:", error);
            this.showToast(this.t("errorProcessingExcel"), "error");
          } finally {
            event.target.value = "";
          }
        };
        reader.readAsArrayBuffer(file);
      },

      exportBondsToExcel() {
        if (this.filteredBondsDashboard.length === 0) {
          this.showToast(this.t("errorNoBondDataToExport"), "warning");
          return;
        }

        const dataToExport = this.filteredBondsDashboard.map((bond) => ({
          [this.t("excelHeaderContract")]: bond.contractNo,
          [this.t("excelHeaderBondNumber")]: bond.bondNumber,
          [this.t("excelHeaderReference")]: bond.ref,
          [this.t("excelHeaderBondType")]: bond.bondType,
          [this.t("excelHeaderAmount")]: bond.amount,
          [this.t("excelHeaderIssueDate")]: bond.issueDate,
          [this.t("excelHeaderExpiryDate")]: bond.expiryDate,
          [this.t("excelHeaderBank")]: bond.issuingBankName,
          [this.t("excelHeaderStatus")]:
            this.getBondStatusClassForDashboard(bond).message,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bonds Export");
        XLSX.writeFile(
          wb,
          `Bonds_Export_${appUtils.format.date(new Date())}.xlsx`
        );
        this.showToast(this.t("bondExportSuccess"), "success");
      },

      goToFilteredBondDashboard() {
        this.clearAllFilters();

        this.viewStates.bondDashboard.filter.status = [
          "Overdue",
          "Expiring Soon",
        ];

        this.currentTab = "cpc-bond-dashboard";

        const bellButton = document.querySelector(
          ".notification-bell-button"
        );
        if (bellButton) {
          const dropdown = bootstrap.Dropdown.getInstance(bellButton);
          if (dropdown) {
            dropdown.hide();
          }
        }
      },
      promptQuickSettle(bond, event) {
        const toggleSwitch = event.target;
        const willBeSettled = toggleSwitch.checked;

        if (bond.isRenewed) {
          toggleSwitch.checked = true;
          return;
        }

        const confirmationConfig = {
          title: willBeSettled
            ? this.t("confirmSettleTitle")
            : this.t("confirmCancelSettleTitle"),
          message: willBeSettled
            ? this.t("confirmSettleMessage", {
              bondNumber: bond.bondNumber,
            })
            : this.t("confirmCancelSettleMessage", {
              bondNumber: bond.bondNumber,
            }),
          confirmButtonText: willBeSettled
            ? this.t("btnConfirmSettle")
            : this.t("btnConfirmCancelSettle"),
          confirmButtonClass: willBeSettled ? "btn-success" : "btn-warning",
          onConfirm: () => {
            confirmationHandled = true;
            this.quickSettleBond(bond, willBeSettled);
          },
          onCancel: () => {
            confirmationHandled = true;
            toggleSwitch.checked = !willBeSettled;
          },
        };

        const modalEl = document.getElementById("confirmationModal");
        let confirmationHandled = false;

        appUtils.ui.showConfirmation(this, confirmationConfig);

        const hideListener = () => {
          if (!confirmationHandled) {
            toggleSwitch.checked = !willBeSettled;
          }
          modalEl.removeEventListener("hide.bs.modal", hideListener);
        };
        modalEl.addEventListener("hide.bs.modal", hideListener, {
          once: true,
        });
      },

      async quickSettleBond(bond, newState) {
        const bondIndex = this.bonds.findIndex((b) => b.id === bond.id);
        if (bondIndex === -1) {
          this.showToast(this.t("errorFindBondToUpdate"), "error");
          return;
        }

        const bondToUpdate = JSON.parse(
          JSON.stringify(this.bonds[bondIndex])
        );

        bondToUpdate.isSettled = newState;
        bondToUpdate.settlementReasonDisplay = newState
          ? "Quick Settle"
          : "";

        try {
          await putBondRecord(databaseService, bondToUpdate);
          this.bonds[bondIndex] = bondToUpdate;

          const message = newState
            ? this.t("bondSettledSuccess", { bondNumber: bond.bondNumber })
            : this.t("bondUnsettledSuccess", {
              bondNumber: bond.bondNumber,
            });
          this.showToast(message, newState ? "success" : "info");
        } catch (error) {
          console.error("Lỗi khi cập nhật trạng thái bảo lãnh:", error);
          this.showToast(this.t("errorUpdateBondStatus"), "error");
        }
      },
      selectBondContract(contract) {
        this.currentEditBond.contractId = contract.id;
        this.bondContractSearchTerm = contract.contractNo;
        this.isBondContractDropdownVisible = false;
      },

      handleBondContractInputBlur() {
        setTimeout(() => {
          this.isBondContractDropdownVisible = false;
        }, 200);
      },

      navigateBondContracts(event) {
        if (
          !this.isBondContractDropdownVisible ||
          this.filteredBondContractsForModal.length === 0
        )
          return;

        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            if (
              this.activeBondContractIndex <
              this.filteredBondContractsForModal.length - 1
            ) {
              this.activeBondContractIndex++;
              this.scrollToActiveItem(event.target);
            }
            break;
          case "ArrowUp":
            event.preventDefault();
            if (this.activeBondContractIndex > 0) {
              this.activeBondContractIndex--;
              this.scrollToActiveItem(event.target);
            }
            break;
          case "Enter":
            if (this.activeBondContractIndex >= 0) {
              event.preventDefault();
              this.selectBondContract(
                this.filteredBondContractsForModal[
                this.activeBondContractIndex
                ]
              );
            } else {
              this.isBondContractDropdownVisible = false;
            }
            break;
          case "Escape":
            this.isBondContractDropdownVisible = false;
            break;
        }
      },

      openBondModal(mode, bond = null) {
        this.bondModalMode = mode;
        this.bondContractSearchTerm = "";
        this.isBondContractDropdownVisible = false;
        this.activeBondContractIndex = -1;

        if (mode === "add") {
          this.currentEditBond = {
            contractId: null,
            bondNumber: "",
            ref: "",
            bondType: "",
            amount: 0,
            displayAmount: "0",
            issueDate: "",
            expiryDate: "",
            issuingBank: "",
            isSettled: false,
          };
        } else {
          this.currentEditBond = JSON.parse(JSON.stringify(bond));
          this.currentEditBond.displayAmount = (
            this.currentEditBond.amount || 0
          ).toLocaleString("vi-VN");
          const contract = this.contracts.find(
            (c) => c.id === bond.contractId
          );
          if (contract) {
            this.bondContractSearchTerm = contract.contractNo;
          }
        }
        appUtils.ui.toggleModal("bondManagementModal", "show");
      },

      closeBondModal() {
        appUtils.ui.toggleModal("bondManagementModal", "hide");
        this.currentEditBond = null;
      },

      formatCurrentBondAmount() {
        if (!this.currentEditBond) return;
        const numericValue = appUtils.text.parseVndAmount(
          this.currentEditBond.displayAmount
        );
        this.currentEditBond.amount = numericValue;
        this.currentEditBond.displayAmount =
          numericValue.toLocaleString("vi-VN");
      },

      async saveBond() {
        if (!this.currentEditBond || !this.currentEditBond.contractId) {
          this.showToast("Vui lòng chọn một hợp đồng.", "error");
          return;
        }
        const bondValidationErrors = validateBondInput(this.currentEditBond);
        if (bondValidationErrors.length > 0) {
          this.showToast(bondValidationErrors[0], "error");
          return;
        }

        if (
          !this.validateDates(this.currentEditBond, [
            "issueDate",
            "expiryDate",
          ])
        ) {
          return;
        }

        try {
          const bondToSave = await saveBondRecord(
            databaseService,
            this.currentEditBond,
            this.bondModalMode,
            this.contracts
          );
          if (this.bondModalMode === "add") {
            this.bonds.push(bondToSave);
          } else {
            const index = this.bonds.findIndex(
              (b) => b.id === bondToSave.id
            );
            if (index > -1) {
              this.bonds[index] = bondToSave;
            }
          }
          this.showToast(
            "Đã lưu thông tin bảo lãnh thành công.",
            "success"
          );
          this.closeBondModal();
        } catch (error) {
          if (error.code === "CONTRACT_NOT_FOUND") {
            console.error(
              "Không tìm thấy hợp đồng tương ứng khi lưu bảo lãnh. Dữ liệu có thể hiển thị N/A."
            );
            this.showToast(this.t("errorContractNotFound"), "error");
            return;
          }
          console.error("Lỗi khi lưu bảo lãnh:", error);
          this.showToast("Lưu bảo lãnh thất bại.", "error");
        }
      },
      async goToBondDashboard(bond) {
        if (!bond.projectId || !bond.vendorId || !bond.contractId) {
          this.showToast(
            "Thông tin hợp đồng không đầy đủ để điều hướng.",
            "warning"
          );
          return;
        }

        this.clearAllFilters();
        const bondFilters = this.viewStates.bondDashboard.filter;

        bondFilters.projectId = [bond.projectId];
        await this.$nextTick();

        bondFilters.vendorId = [bond.vendorId];
        await this.$nextTick();

        bondFilters.contractId = [bond.contractId];

        this.currentTab = "cpc-bond-dashboard";

        const bellButton = document.querySelector(
          ".notification-bell-button"
        );
        if (bellButton) {
          const dropdown = bootstrap.Dropdown.getInstance(bellButton);
          if (dropdown) {
            dropdown.hide();
          }
        }
      },

      cancelAction() {
        if (typeof this.confirmation.onCancel === "function") {
          this.confirmation.onCancel();
        }
        appUtils.ui.toggleModal("confirmationModal", "hide");
      },
      promptForVendorMerge(sourceVendor, destinationVendor) {
        appUtils.ui.toggleModal("vendorManagementModal", "hide");

        appUtils.ui.showConfirmation(this, {
          title: "Phát hiện Trùng Mã Nhà Cung Cấp",
          message: `Mã nhà cung cấp <strong>${destinationVendor.vendorNo}</strong> đã tồn tại cho NCC "<strong>${destinationVendor.name}</strong>".<br><br>Bạn có muốn hợp nhất NCC bạn đang sửa ("<strong>${sourceVendor.name}</strong>") vào NCC đã có không? <br><br><strong class="text-danger">Lưu ý:</strong> Toàn bộ hợp đồng của NCC "${sourceVendor.name}" sẽ được chuyển sang cho "${destinationVendor.name}" và NCC "${sourceVendor.name}" sẽ bị xóa. Hành động này không thể hoàn tác.`,
          confirmButtonText: `Đồng ý Hợp nhất`,
          confirmButtonClass: "btn-warning",
          onConfirm: () => {
            this.performVendorMerge(sourceVendor.id, destinationVendor.id);
          },
          onCancel: () => {
            appUtils.ui.toggleModal("vendorManagementModal", "show");
          },
        });
      },
      async performVendorMerge(sourceVendorId, destinationVendorId) {
        if (
          !sourceVendorId ||
          !destinationVendorId ||
          sourceVendorId === destinationVendorId
        ) {
          this.showToast(
            "Lỗi: ID nhà cung cấp không hợp lệ để hợp nhất.",
            "error"
          );
          return;
        }

        const sourceVendor = this.vendors.find(
          (v) => v.id === sourceVendorId
        );
        const destinationVendor = this.vendors.find(
          (v) => v.id === destinationVendorId
        );

        if (!sourceVendor || !destinationVendor) {
          this.showToast(
            "Lỗi: Không tìm thấy nhà cung cấp trong hệ thống.",
            "error"
          );
          return;
        }

        try {
          await mergeVendorReferences(
            databaseService,
            sourceVendorId,
            destinationVendorId
          );
          const freshData = await databaseService.getAllData();
          this._loadState(freshData);

          this.$nextTick(() => { });

          this.showToast(
            `Đã hợp nhất thành công NCC "${sourceVendor.name}" vào "${destinationVendor.name}"!`,
            "success"
          );
          this.closeVendorModal();
        } catch (error) {
          console.error("Lỗi khi hợp nhất nhà cung cấp:", error);
          this.showToast(
            "Đã xảy ra lỗi trong quá trình hợp nhất. Dữ liệu đã được hoàn tác.",
            "error"
          );
        }
      },
      exportMasterVendors() {
        if (!this.vendors || this.vendors.length === 0) {
          this.showToast(this.t("errorNoVendorDataToExport"), "warning");
          return;
        }

        const dataToExport = this.vendors.map((vendor) => ({
          name: vendor.name,
          abbrName: vendor.abbrName,
          vendorNo: vendor.vendorNo,
          contactPerson: vendor.contactPerson || "",
          phoneNumber: vendor.phoneNumber || ""
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Vendors");

        const fileName = `MasterData_Vendors_${appUtils.format.date(
          new Date()
        )}.xlsx`;
        XLSX.writeFile(wb, fileName);

        this.showToast(this.t("vendorExportSuccess"), "success");
      },
      async cleanupOrphanData() {
        console.log("Scanning for orphan data with complete logic...");

        const validProjectIds = new Set(this.projects.map((p) => p.id));
        const validVendorIds = new Set(this.vendors.map((v) => v.id));
        const validContractIds = new Set(this.contracts.map((c) => c.id));
        const validCpcIds = new Set(this.cpcItems.map((cpc) => cpc.id));

        const allProjectIdsInUse = new Set(
          this.contracts.map((c) => c.projectId)
        );
        this.cpcItems.forEach((cpc) => {
          if (cpc.projectId) {
            allProjectIdsInUse.add(cpc.projectId);
          }
        });

        const projectsWithNoLinks = this.projects.filter(
          (p) => !allProjectIdsInUse.has(p.id)
        );

        const contractsWithOrphanProject = this.contracts.filter(
          (c) => c.projectId && !validProjectIds.has(c.projectId)
        );

        const contractsWithOrphanVendor = this.contracts.filter(
          (c) => c.vendorId && !validVendorIds.has(c.vendorId)
        );

        const installmentsWithOrphanCpc = this.installments.filter(
          (inst) => inst.cpcId && !validCpcIds.has(inst.cpcId)
        );

        const bondsWithOrphanCpc = this.bonds.filter(
          (bond) => bond.cpcId && !validCpcIds.has(bond.cpcId)
        );

        this.orphanData = {
          projectsWithNoContracts: projectsWithNoLinks,
          contractsWithOrphanProject,
          contractsWithOrphanVendor,
          installmentsWithOrphanCpc,
          bondsWithOrphanCpc,
          cpcWithOrphanContract: [],
        };

        appUtils.ui.toggleModal("orphanDataModal", "show");
      },

      async deleteOrphanItem(tableName, itemId) {
        appUtils.ui.toggleModal("orphanDataModal", "hide");

        appUtils.ui.showConfirmation(this, {
          title: "Xác nhận Xóa",
          message: `Bạn có chắc chắn muốn xóa vĩnh viễn mục này (ID: ${itemId}) không?`,
          confirmButtonText: "Xóa",
          onCancel: () => {
            appUtils.ui.toggleModal("orphanDataModal", "show");
          },
          onConfirm: async () => {
            try {
              await databaseService.db[tableName].delete(itemId);

              const freshData = await databaseService.getAllData();
              this._loadState(freshData);

              this.showToast(
                `Đã xóa mục (ID: ${itemId}) thành công.`,
                "success"
              );

              this.cleanupOrphanData();
            } catch (error) {
              console.error(
                `Lỗi khi xóa mục ${itemId} từ bảng ${tableName}:`,
                error
              );
              this.showToast(
                "Xóa thất bại. Vui lòng kiểm tra console.",
                "error"
              );
              appUtils.ui.toggleModal("orphanDataModal", "show");
            }
          },
        });
      },

      deleteAllOrphans() {
        if (!this.requirePermission("admin.maintenance")) return;
        appUtils.ui.showConfirmation(this, {
          title: "Xác nhận Xóa Tất cả",
          message:
            "Hành động này sẽ xóa vĩnh viễn **TẤT CẢ** các mục được liệt kê. Bạn có chắc chắn muốn tiếp tục không?",
          confirmButtonClass: "btn-danger",
          confirmButtonText: "Vâng, Xóa Tất cả",
          onCancel: () => {
            appUtils.ui.toggleModal("orphanDataModal", "show");
          },
          onConfirm: async () => {
            try {
              const idsToDelete = {};
              const tableNameMapping = {
                contractsWithOrphanProject: "contracts",
                contractsWithOrphanVendor: "contracts",
                projectsWithNoContracts: "projects",
                installmentsWithOrphanCpc: "installments",
                bondsWithOrphanCpc: "bonds",
              };

              for (const key in this.orphanData) {
                const actualTableName = tableNameMapping[key];
                if (!actualTableName) continue;

                const items = this.orphanData[key];
                if (items.length > 0) {
                  if (!idsToDelete[actualTableName]) {
                    idsToDelete[actualTableName] = [];
                  }
                  idsToDelete[actualTableName].push(
                    ...items.map((item) => item.id)
                  );
                }
              }

              await deleteRecordsByTableIds(databaseService, idsToDelete);

              const freshData = await databaseService.getAllData();
              this._loadState(freshData);

              for (const key in this.orphanData) {
                this.orphanData[key] = [];
              }

              this.showToast(
                "Đã dọn dẹp tất cả dữ liệu mồ côi thành công.",
                "success"
              );
            } catch (error) {
              console.error("Lỗi khi xóa tất cả dữ liệu mồ côi:", error);
              this.showToast(
                "Xóa hàng loạt thất bại. Vui lòng kiểm tra console.",
                "error"
              );
            } finally {
              appUtils.ui.toggleModal("confirmationModal", "hide");
              appUtils.ui.toggleModal("orphanDataModal", "hide");
            }
          },
        });
      },
      openProjectBackupModal() {
        this.selectedProjectIdForBackup = null;
        appUtils.ui.toggleModal("projectBackupModal", "show");
        this.$nextTick(() => {
          lucide.createIcons();
        });
      },

      triggerProjectImport() {
        this.$refs.importProjectInput.click();
      },

      exportSelectedProject() {
        const projectId = this.selectedProjectIdForBackup;
        if (!projectId) {
          this.showToast("Vui lòng chọn một dự án.", "warning");
          return;
        }

        const projectToBackup = this.projects.find(
          (p) => p.id === projectId
        );
        if (!projectToBackup) {
          this.showToast("Không tìm thấy dự án.", "error");
          return;
        }

        const contractsInProject = this.contracts.filter(
          (c) => c.projectId === projectId
        );
        const contractIds = new Set(contractsInProject.map((c) => c.id));
        const vendorIds = new Set(
          contractsInProject.map((c) => c.vendorId)
        );

        const cpcItemsInProject = this.cpcItems.filter((cpc) =>
          contractIds.has(cpc.contractId)
        );
        const cpcIds = new Set(cpcItemsInProject.map((cpc) => cpc.id));

        const projectData = {
          type: "ProjectBackup",
          version: "1.0",
          exportedAt: new Date().toISOString(),
          projectData: {
            projects: [projectToBackup],
            vendors: this.vendors.filter((v) => vendorIds.has(v.id)),
            contracts: contractsInProject,
            cpcItems: cpcItemsInProject,
            cpcDetailRows: this.cpcDetailRows.filter((row) =>
              contractIds.has(row.contractId)
            ),
            installments: this.installments.filter((inst) =>
              cpcIds.has(inst.cpcId)
            ),
            bonds: this.bonds.filter((bond) => contractIds.has(bond.contractId)),
          },
        };

        const blob = new Blob([JSON.stringify(projectData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Backup_${projectToBackup.name.replace(
          / /g,
          "_"
        )}_${appUtils.format.date(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast(
          `Đã xuất dữ liệu cho dự án "${projectToBackup.name}" thành công.`,
          "success"
        );
        appUtils.ui.toggleModal("projectBackupModal", "hide");
      },

      handleProjectFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsedData = JSON.parse(e.target.result);
            if (
              parsedData.type !== "ProjectBackup" ||
              !parsedData.projectData
            ) {
              this.showToast(
                "File không hợp lệ hoặc không phải là file backup dự án.",
                "error"
              );
              return;
            }

            const projectFromFile = parsedData.projectData.projects[0];
            const existingProject = this.projects.find(
              (p) =>
                p.name.toLowerCase() === projectFromFile.name.toLowerCase()
            );

            if (existingProject) {
              appUtils.ui.showConfirmation(this, {
                title: "Dự án đã tồn tại",
                message: `Dự án "<strong>${existingProject.name}</strong>" đã có trong dữ liệu hiện tại. Bạn có muốn <strong>xóa toàn bộ dữ liệu cũ</strong> của dự án này và thay thế bằng dữ liệu từ file không?`,
                confirmButtonText: "Ghi đè",
                confirmButtonClass: "btn-danger",
                onConfirm: async () => {
                  await this.importProjectData(
                    parsedData.projectData,
                    existingProject.id
                  );
                },
              });
            } else {
              appUtils.ui.showConfirmation(this, {
                title: "Xác nhận Import Dự án Mới",
                message: `Bạn có chắc chắn muốn thêm dự án "<strong>${projectFromFile.name}</strong>" và tất cả dữ liệu liên quan vào ứng dụng không?`,
                confirmButtonText: "Import",
                confirmButtonClass: "btn-primary",
                onConfirm: async () => {
                  await this.importProjectData(
                    parsedData.projectData,
                    null
                  );
                },
              });
            }
          } catch (error) {
            console.error("Lỗi khi import dự án:", error);
            this.showToast("Có lỗi xảy ra khi xử lý file.", "error");
          }
        };
        reader.readAsText(file);
        event.target.value = "";
      },

      async importProjectData(data, existingProjectIdToDelete) {
        if (!this.requirePermission("import.execute")) return;
        try {
          await importProjectDatasetAtomic(
            databaseService,
            data,
            existingProjectIdToDelete
          );

          const allData = await databaseService.getAllData();
          this._loadState(allData);

          this.showToast(
            "Dữ liệu dự án đã được import thành công!",
            "success"
          );
        } catch (error) {
          console.error(
            "Lỗi nghiêm trọng khi import dữ liệu dự án:",
            error
          );
          this.showToast(
            "Quá trình import thất bại. Vui lòng kiểm tra console.",
            "error"
          );
        }
      },
      triggerCogsFileUpload() {
        this.$refs.cogsUploadInput.click();
      },

      handleCogsFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), {
              type: "array",
            });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            if (!sheet) {
              this.showToast(
                this.t("errorSheetNotFound", {
                  sheetName: sheetName || "data",
                }),
                "error"
              );
              return;
            }

            const jsonData = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: null,
            });

            const excelData = {};
            const summarySap = {};
            let processedRows = 0;

            for (let i = 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.length === 0) continue;

              const contractKey = row[2] ? String(row[2]).trim() : null;
              const glAccount = row[1] ? String(row[1]).trim() : null;
              const amountValue =
                row[7] != null
                  ? parseFloat(String(row[7]).replace(/,/g, ""))
                  : NaN;

              if (isNaN(amountValue)) continue;

              if (contractKey) {
                if (!excelData[contractKey]) {
                  excelData[contractKey] = { invAmount: 0 };
                }
                excelData[contractKey].invAmount += amountValue;
              }

              if (glAccount) {
                if (!summarySap[glAccount]) {
                  summarySap[glAccount] = 0;
                }
                summarySap[glAccount] += amountValue;
              }

              if (contractKey || glAccount) {
                processedRows++;
              }
            }

            if (processedRows > 0) {
              this.cogsComparisonData = excelData;
              this.cogsSummaryFromSap = summarySap;
              this.showToast(
                this.t("cogsUploadSuccess", { count: processedRows }),
                "success"
              );
            } else {
              this.showToast(this.t("errorNoValidDataInExcel"), "warning");
            }
          } catch (error) {
            console.error("Lỗi xử lý file COGS:", error);
            this.showToast(this.t("errorProcessingExcel"), "error");
          } finally {
            event.target.value = "";
          }
        };
        reader.readAsArrayBuffer(file);
      },

      clearCogsComparison() {
        this.cogsComparisonData = null;
        this.cogsSummaryFromSap = null;
        this.showToast(this.t("cogsReconciliationCleared"), "info");
      },

      runDataMigrationToNumericIDs() { },
      promptAndDebugVendor() {
        const vendorNo = window.prompt(
          "Vui lòng nhập Mã Nhà cung cấp (Vendor No.) cần debug:",
          ""
        );

        if (vendorNo && vendorNo.trim()) {
          this.debugVendorBalance(vendorNo.trim());
        } else {
          console.log("Hủy thao tác debug.");
        }
      },
      debugVendorBalance(vendorNo) {
        console.clear();
        console.log(
          `%c--- DEBUG CÔNG NỢ NCC: ${vendorNo} (Đã đồng bộ logic 3311/3312) ---`,
          "color: white; background: #0d6efd; font-size: 16px; font-weight: bold; padding: 8px; border-radius: 4px;"
        );

        const vendor = this.vendors.find((v) => v.vendorNo === vendorNo);
        if (!vendor) {
          console.error(`Lỗi: Không tìm thấy nhà cung cấp với mã ${vendorNo}`);
          return;
        }
        console.log(`Nhà cung cấp: %c${vendor.name}`, "font-weight: bold; color: blue; font-size: 14px;");

        const vendorContracts = this.contracts.filter((c) => c.vendorId === vendor.id);
        const asOfDate = this.viewStates.vendorBalance.filter.asOfDate;
        const reportDate = new Date(asOfDate || new Date());
        reportDate.setHours(23, 59, 59, 999);

        console.log(`Ngày chốt số liệu: %c${reportDate.toLocaleDateString("vi-VN")}`, "font-weight: bold; color: #c55");

        let grandTotal3311 = 0;
        let grandTotal3312 = 0;

        const contractsByProject = new Map();
        vendorContracts.forEach(c => {
          if (!contractsByProject.has(c.projectId)) contractsByProject.set(c.projectId, []);
          contractsByProject.get(c.projectId).push(c);
        });

        contractsByProject.forEach((contracts, projectId) => {
          const project = this.projectMap.get(projectId);
          console.groupCollapsed(`%c📂 DỰ ÁN: ${project ? project.name.toUpperCase() : 'UNKNOWN'}`, "color: purple; font-weight: bold;");

          contracts.forEach(contract => {
            const balance = this.calculateContractBalanceAsOf(contract.id, asOfDate || new Date().toISOString().slice(0, 10));

            const tableData = this.cpcDetailRows.filter(r => r.contractId === contract.id);
            const cpcItemsForContract = this.cpcItems.filter(c => c.contractId === contract.id);

            console.group(`🔍 Hợp đồng: ${contract.contractNo} (${contract.currency})`);

            const advanceCpcNos = [...new Set(tableData.filter(r => (r.cpcAdvance || 0) !== 0).map(r => r.cpcNo).filter(Boolean))];
            const advanceCpcs = cpcItemsForContract.filter(c => advanceCpcNos.includes(c.cpcIdentifier));

            console.log("%c[3312 - Tạm ứng]", "font-weight: bold; color: #1976d2;");
            let realizedAdvVND = 0;
            advanceCpcs.forEach(c => {
              const insts = (this.installmentsByCpcId.get(c.id) || []).filter(i => i.date && new Date(i.date) <= reportDate);
              const sumInst = insts.reduce((s, i) => s + (contract.currency === 'USD' ? (i.amountUsd || 0) : (i.amount || 0)), 0);
              const sumInstVND = insts.reduce((s, i) => s + (i.amountVND || i.amount || 0), 0);
              realizedAdvVND += sumInstVND;
              if (sumInst !== 0) console.log(`  + Chi tạm ứng CPC ${c.cpcIdentifier}: ${this.formatCurrency(sumInstVND)}`);
            });

            const repayments = tableData.filter(r => r.invoicePostingDate && new Date(r.invoicePostingDate) <= reportDate && (r.cpcRepayment || 0) !== 0);
            const totalRepayVND = repayments.reduce((s, r) => {
              let rate = 1;
              if (contract.currency === 'USD') {
                rate = parseFloat(r.invoiceExchangeRate) || 0;
                if (rate <= 0) {
                  const cpc = cpcItemsForContract.find(i => i.cpcIdentifier === r.cpcNo);
                  rate = cpc ? cpc.exchangeRate : 0;
                }
              }
              return s + (r.cpcRepayment * rate);
            }, 0);

            if (totalRepayVND !== 0) console.log(`  - Đã hoàn ứng (theo Hóa đơn): ${this.formatCurrency(Math.abs(totalRepayVND))}`);
            console.log(`  => Dư tạm ứng (3312): ${this.formatCurrency(balance.advanceBalance)}`);

            console.log("%c[3311 - Phải trả]", "font-weight: bold; color: #d32f2f;");
            const invoices = tableData.filter(r => r.invoicePostingDate && new Date(r.invoicePostingDate) <= reportDate);
            const totalInvVND = invoices.reduce((s, r) => {
              let rate = 1;
              if (contract.currency === 'USD') {
                rate = parseFloat(r.invoiceExchangeRate) || 0;
                if (rate <= 0) {
                  const cpc = cpcItemsForContract.find(i => i.cpcIdentifier === r.cpcNo);
                  rate = cpc ? cpc.exchangeRate : 0;
                }
              }
              return s + (r.invoiceTotal * rate);
            }, 0);

            const allPayments = cpcItemsForContract.flatMap(c => (this.installmentsByCpcId.get(c.id) || []))
              .filter(i => i.date && new Date(i.date) <= reportDate);
            const totalPaidVND = allPayments.reduce((s, i) => s + (i.amountVND || i.amount || 0), 0);

            console.log(`  + Tổng Hóa đơn (VND): ${this.formatCurrency(totalInvVND)}`);
            console.log(`  - Tổng Đã trả (VND): ${this.formatCurrency(totalPaidVND)}`);
            console.log(`  + Dư tạm ứng: ${this.formatCurrency(balance.advanceBalance)}`);
            console.log(`  => Phải trả NCC (3311): ${this.formatCurrency(balance.finalPayable)}`);

            console.groupEnd();

            grandTotal3311 += balance.finalPayable;
            grandTotal3312 += balance.advanceBalance;
          });
          console.groupEnd();
        });

        console.log(
          `%c--- TỔNG CỘNG CUỐI CÙNG ---`,
          "color: white; background: green; font-size: 14px; font-weight: bold; padding: 5px; margin-top: 20px; display: block;"
        );
        console.log(`%cGL 3311 (Phải trả): ${this.formatCurrency(grandTotal3311)}`, "font-size: 18px; font-weight: bold; color: #d32f2f;");
        console.log(`%cGL 3312 (Tạm ứng): ${this.formatCurrency(grandTotal3312)}`, "font-size: 18px; font-weight: bold; color: #1976d2;");
      },
      calculateContractBalanceAsOf(contractId, asOfDate) {
        const tableData =
          this.cpcDetailRowsByContractId.get(contractId) || [];
        const contract = this.contractMap.get(contractId);

        if (!contract || !asOfDate) {
          return { finalPayable: 0, advanceBalance: 0 };
        }

        const reportDate = new Date(asOfDate);
        reportDate.setHours(23, 59, 59, 999);

        const cpcItemsForContract =
          this.cpcItemsByContractId.get(contractId) || [];

        const advanceCpcNos = [
          ...new Set(
            tableData
              .filter((row) => (row.cpcAdvance || 0) !== 0)
              .map((row) => row.cpcNo)
              .filter(Boolean)
          ),
        ];

        const advanceCpcIds = cpcItemsForContract
          .filter((cpc) => advanceCpcNos.includes(cpc.cpcIdentifier))
          .map((cpc) => cpc.id);

        const totalRealizedAdvanceAsOf = advanceCpcIds.reduce(
          (sum, cpcId) => {
            const installmentsForCpc =
              this.installmentsByCpcId.get(cpcId) || [];

            const cpcItem = cpcItemsForContract.find((c) => c.id === cpcId);

            const paidForCpc = installmentsForCpc
              .filter(
                (inst) => inst.date && new Date(inst.date) <= reportDate
              )
              .reduce((cpcSum, inst) => {
                let paymentValue =
                  contract.currency === "USD"
                    ? inst.amountUsd || 0
                    : inst.amountVND || inst.amount || 0;

                if (cpcItem && cpcItem.amount < 0) {
                  paymentValue = -Math.abs(paymentValue);
                }

                return cpcSum + paymentValue;
              }, 0);
            return sum + paidForCpc;
          },
          0
        );

        const totalRepaymentAsOf = tableData
          .filter(
            (row) =>
              row.invoicePostingDate &&
              new Date(row.invoicePostingDate) <= reportDate
          )
          .reduce((sum, row) => sum + (row.cpcRepayment || 0), 0);

        const advanceBalanceAsOf =
          totalRealizedAdvanceAsOf + totalRepaymentAsOf;

        const totalInvoicedAsOf = tableData
          .filter(
            (row) =>
              row.invoicePostingDate &&
              new Date(row.invoicePostingDate) <= reportDate
          )
          .reduce((sum, row) => sum + (row.invoiceTotal || 0), 0);

        const allCpcIdsForContract = cpcItemsForContract.map(
          (cpc) => cpc.id
        );

        const totalPaidAsOf = allCpcIdsForContract.reduce((sum, cpcId) => {
          const installmentsForCpc =
            this.installmentsByCpcId.get(cpcId) || [];
          const paidForCpc = installmentsForCpc
            .filter(
              (inst) => inst.date && new Date(inst.date) <= reportDate
            )
            .reduce((cpcSum, inst) => {
              const cpcItem = cpcItemsForContract.find(
                (cpc) => cpc.id === inst.cpcId
              );
              let paymentValue =
                contract.currency === "USD"
                  ? inst.amountUsd || 0
                  : inst.amountVND || inst.amount || 0;

              if (cpcItem && cpcItem.amount < 0) {
                paymentValue = -Math.abs(paymentValue);
              }
              return cpcSum + paymentValue;
            }, 0);
          return sum + paidForCpc;
        }, 0);

        const remainingPayableFromInvoice =
          totalInvoicedAsOf - totalPaidAsOf;

        const finalPayableAsOf =
          remainingPayableFromInvoice + advanceBalanceAsOf;

        return {
          finalPayable: Math.max(0, finalPayableAsOf),
          advanceBalance: advanceBalanceAsOf,
        };
      },
      toggleZeroFilter(filterObject, key, value) {
        if (filterObject[key] === value) {
          filterObject[key] = null;
        } else {
          filterObject[key] = value;
        }
      },
      getIconForKey(key) {
        const iconMap = {
          "cpc-tracking": "clipboard-list",
          "cpc-details": "table-2",
          "cogs-dashboard": "clipboard-check",
          "vendor-balance": "scale",
          "cpc-dashboard": "landmark",
          "cpc-swap-dashboard": "repeat",
          "cpc-bond-dashboard": "shield",
          "cpc-contract-dashboard": "file-signature",
          "cpc-report-dashboard": "bar-chart-3",
          "invoice-aging": "history",
          "master-data": "database",
          "admin-access": "shield-check",
        };
        return iconMap[key] || "file";
      },
      handleSidebarShortcut(event) {
        if (event.altKey && event.key.toLowerCase() === "s") {
          event.preventDefault();
          this.toggleSidebarNavigation();
          return;
        }

        if (!this.isSidebarNavigating) return;

        switch (event.key) {
          case "ArrowUp":
            event.preventDefault();
            this.navigateSidebar("prev");
            break;
          case "ArrowDown":
            event.preventDefault();
            this.navigateSidebar("next");
            break;
          case "Enter":
            event.preventDefault();
            this.selectSidebarTab();
            break;
          case "Escape":
            event.preventDefault();
            this.toggleSidebarNavigation(false);
            break;
        }
      },

      toggleSidebarNavigation(forceState = null) {
        this.isSidebarNavigating =
          forceState !== null ? forceState : !this.isSidebarNavigating;

        if (this.isSidebarNavigating) {
          this.sidebarNavIndex = this.sidebarTabs.findIndex(
            (tab) => tab.key === this.currentTab
          );
          if (this.sidebarNavIndex === -1) {
            this.sidebarNavIndex = 0;
          }
        } else {
          this.sidebarNavIndex = -1;
        }
      },

      navigateSidebar(direction) {
        const tabCount = this.sidebarTabs.length;
        if (tabCount === 0) return;

        let newIndex = this.sidebarNavIndex;
        if (direction === "next") {
          newIndex = (this.sidebarNavIndex + 1) % tabCount;
        } else if (direction === "prev") {
          newIndex = (this.sidebarNavIndex - 1 + tabCount) % tabCount;
        }
        this.sidebarNavIndex = newIndex;
      },

      selectSidebarTab() {
        if (
          this.sidebarNavIndex > -1 &&
          this.sidebarNavIndex < this.sidebarTabs.length
        ) {
          const selectedTabKey = this.sidebarTabs[this.sidebarNavIndex].key;
          this.currentTab = selectedTabKey;
          this.toggleSidebarNavigation(false);
        }
      },
      toggleQuickMenu(forceState = null) {
        this.isQuickMenuOpen =
          forceState !== null ? forceState : !this.isQuickMenuOpen;

        if (this.isQuickMenuOpen) {
          this.activeQuickMenuIndex = 0;
        } else {
          this.activeQuickMenuIndex = -1;
        }
      },

      handleQuickMenuShortcut(event) {
        if (event.altKey && event.key.toLowerCase() === "a") {
          event.preventDefault();
          this.toggleQuickMenu();
        }

        if (!this.isQuickMenuOpen) return;

        switch (event.key) {
          case "ArrowRight":
          case "ArrowDown":
            event.preventDefault();
            this.navigateQuickMenu("next");
            break;
          case "ArrowLeft":
          case "ArrowUp":
            event.preventDefault();
            this.navigateQuickMenu("prev");
            break;
          case "Enter":
            event.preventDefault();
            this.executeQuickMenuAction();
            break;
          case "Escape":
            event.preventDefault();
            this.toggleQuickMenu(false);
            break;
        }
      },

      navigateQuickMenu(direction) {
        const itemCount = this.quickMenuItems.length;
        if (itemCount === 0) return;

        let newIndex = this.activeQuickMenuIndex;
        if (direction === "next") {
          newIndex = (this.activeQuickMenuIndex + 1) % itemCount;
        } else if (direction === "prev") {
          newIndex =
            (this.activeQuickMenuIndex - 1 + itemCount) % itemCount;
        }
        this.activeQuickMenuIndex = newIndex;
      },

      executeQuickMenuAction(action = null) {
        if (!action) {
          if (this.activeQuickMenuIndex < 0) return;
          action = this.quickMenuItems[this.activeQuickMenuIndex].action;
        }

        switch (action) {
          case "addCpc":
            this.addNewCpcItem();
            break;
          case "addContract":
            this.addNewContractItem();
            break;
          case "addVendor":
            this.openVendorModal("add");
            break;
          case "addBond":
            this.openBondModal("add");
            break;
        }

        this.toggleQuickMenu(false);
      },

      async openVendorModal(mode = "add", vendor = null) {
        this.vendorModalMode = mode;
        if (mode === "add") {
          this.currentEditVendor = {
            name: "", abbrName: "", vendorNo: "",
            contactPerson: "", phoneNumber: "" // Khởi tạo trống
          };
        } else {
          // Đảm bảo các trường mới tồn tại để tránh lỗi undefined
          this.currentEditVendor = {
            contactPerson: "",
            phoneNumber: "",
            ...vendor
          };
        }
        appUtils.ui.toggleModal("vendorManagementModal", "show");
      },

      closeVendorModal() {
        appUtils.ui.toggleModal("vendorManagementModal", "hide");
        this.currentEditVendor = null;
      },

      async saveVendor() {
        if (!this.requirePermission("masterdata.manage")) return;
        if (
          !this.currentEditVendor ||
          !this.currentEditVendor.name.trim()
        ) {
          this.showToast(this.t("errorVendorNameRequired"), "error");
          return;
        }
        if (
          !this.currentEditVendor.vendorNo ||
          !this.currentEditVendor.vendorNo.trim()
        ) {
          this.showToast(this.t("errorVendorNoRequired"), "error");
          return;
        }

        const vendorName = this.currentEditVendor.name.trim();
        const vendorNo = this.currentEditVendor.vendorNo.trim();

        const isNameDuplicate = this.vendors.some(
          (v) =>
            v.name.toLowerCase() === vendorName.toLowerCase() &&
            v.id !== this.currentEditVendor.id
        );
        if (isNameDuplicate) {
          this.showToast(
            this.t("errorVendorNameExists", { vendorName: vendorName }),
            "error"
          );
          return;
        }

        const duplicateVendorByNo = this.vendors.find(
          (v) =>
            v.vendorNo &&
            v.vendorNo.toLowerCase() === vendorNo.toLowerCase() &&
            v.id !== this.currentEditVendor.id
        );
        if (duplicateVendorByNo) {
          this.promptForVendorMerge(
            this.currentEditVendor,
            duplicateVendorByNo
          );
          return;
        }

        try {
          const vendorToSave = await saveVendorRecord(
            databaseService,
            this.currentEditVendor,
            this.vendorModalMode
          );

          if (this.vendorModalMode === "add") {
            this.vendors.push(vendorToSave);
          } else {
            const index = this.vendors.findIndex((v) => v.id === vendorToSave.id);
            if (index !== -1) {
              this.cpcItems.forEach((cpc) => {
                if (cpc.vendorId === vendorToSave.id) {
                  cpc.vendorName = vendorToSave.name;
                  cpc.vendorNameAbbr = vendorToSave.abbrName;
                  cpc.vendorNo = vendorToSave.vendorNo;
                }
              });
              this.vendors[index] = vendorToSave;
            }
          }
          this.initializeFuse();
          this.showToast(this.t("vendorSavedSuccess"), "success");
          this.closeVendorModal();
        } catch (error) {
          console.error("Error saving vendor:", error);
          if (error.name === "ConstraintError") {
            this.showToast(
              `Lỗi: Tên hoặc Mã NCC đã tồn tại trong cơ sở dữ liệu.`,
              "error"
            );
          } else {
            this.showToast(this.t("vendorSaveFailed"), "error");
          }
        }
      },

      selectVendor(vendor) {
        const activeItem = this.currentEditItem || this.currentEditContract;

        if (activeItem) {
          activeItem.vendorName = vendor.name;
          activeItem.vendorNo = vendor.vendorNo;

          if (this.currentEditContract) {
            this.currentEditContract.vendorAbbrName = vendor.abbrName;
          }
        }

        this.vendorSearchTerm = vendor.name;
        this.isVendorDropdownVisible = false;
        this.filteredVendors = [];

        this.$nextTick(() => {
          if (this.currentEditItem) {
            this.autoFillFromMasterContract();
          }
        });
      },
      handleVendorInputBlur() {
        setTimeout(() => {
          this.isVendorDropdownVisible = false;
        }, 200);
      },
      navigateVendors(event) {
        if (!this.isVendorDropdownVisible) return;
        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            if (this.activeVendorIndex < this.filteredVendors.length - 1)
              this.activeVendorIndex++;
            break;
          case "ArrowUp":
            event.preventDefault();
            if (this.activeVendorIndex > 0) this.activeVendorIndex--;
            break;
          case "Enter":
            event.preventDefault();
            if (this.activeVendorIndex >= 0)
              this.selectVendor(
                this.filteredVendors[this.activeVendorIndex]
              );
            break;
          case "Escape":
            this.isVendorDropdownVisible = false;
            break;
        }
      },
      syncVendorSearch(name) {
        this.vendorSearchTerm = name || "";
      },

      deleteVendor(vendor) {
        if (this.vendorUsageCount[vendor.id] > 0) {
          this.showToast(this.t("errorVendorInUse"), "error");
          return;
        }

        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeletion"),
          message: this.t("confirmDeleteVendorMessage", {
            vendorName: vendor.name,
          }),
          onConfirm: async () => {
            try {
              const { vendorId } = await deleteVendorRecord(
                databaseService,
                vendor.id
              );
              const index = this.vendors.findIndex(
                (v) => v.id === vendorId
              );
              if (index > -1) {
                this.vendors.splice(index, 1);
                this.showToast(this.t("vendorDeletedSuccess"), "success");
              }
            } catch (error) {
              console.error("Error deleting vendor:", error);
              this.showToast(this.t("vendorDeleteFailed"), "error");
            }
          },
        });
      },
      deleteProject(project) {
        if (this.projectUsageCount[project.id] > 0) {
          this.showToast(this.t("errorProjectInUse"), "error");
          return;
        }

        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeletion"),
          message: this.t("confirmDeleteProjectMessage", {
            projectName: project.name,
          }),
          onConfirm: async () => {
            try {
              const { projectId } = await deleteProjectRecord(
                databaseService,
                project.id
              );
              const index = this.projects.findIndex(
                (p) => p.id === projectId
              );
              if (index > -1) {
                this.projects.splice(index, 1);
                this.showToast(this.t("projectDeletedSuccess"), "success");
              }
            } catch (error) {
              console.error("Error deleting project:", error);
              this.showToast(this.t("projectDeleteFailed"), "error");
            }
          },
        });
      },

      _getAppState() {
        return {
          projects: this.projects,
          vendors: this.vendors,
          banks: this.banks,
          contracts: this.contracts,
          cpcItems: this.cpcItems,
          installments: this.installments,
          bonds: this.bonds,
          cpcDetailRows: this.cpcDetailRows,
          categories: this.reportCategoriesFromDB,
        };
      },
      _loadState(data) {
        if (data) {
          this.projects = data.projects || [];
          this.vendors = data.vendors || [];
          this.banks = data.banks || [];
          this.contracts = data.contracts || [];
          this.cpcItems = data.cpcItems || [];
          this.installments = data.installments || [];
          this.bonds = data.bonds || [];
          this.cpcDetailRows =
            data.cpcDetailRows ||
            (Array.isArray(data.cpcDetailsData)
              ? []
              : this.migrateOldLocalStorageFormat(data.cpcDetailsData));
        }
      },
      migrateOldLocalStorageFormat(oldData) {
        if (!oldData || typeof oldData !== "object") return [];
        console.warn(
          "Migrating old backup file format to new cpcDetailRows structure."
        );
        const newRows = [];
        for (const contractId in oldData) {
          if (Array.isArray(oldData[contractId])) {
            oldData[contractId].forEach((row) => {
              newRows.push({ ...row, contractId });
            });
          }
        }
        return newRows;
      },
      async loadDataFromIndexedDB() {
        try {
          const data = await databaseService.getAllData();
          if (
            data &&
            (data.cpcItems?.length > 0 || data.contracts?.length > 0)
          ) {
            console.log("Successfully loaded data from IndexedDB.");
            this._loadState(data);

            // this._recalculateAllDetailRowsAfterLoad();

            return true;
          }
          console.log(
            "IndexedDB is empty. Will attempt to load from LocalStorage."
          );
          return false;
        } catch (error) {
          console.error("Failed to load data from IndexedDB:", error);
          this.showToast(
            "Unable to load data from browser database.",
            "error"
          );
          return false;
        }
      },

      backupDataToFile() {
        const rawData = this._getAppState();

        const cleanItem = (item, type) => {
          const cleaned = { ...item };

          const uiKeys = [
            "displayAmount",
            "displayAmountUsd",
            "displayAmountExclVAT",
            "displayVatAmount",
            "displayExchangeRate",
            "isExpanded",
            "_isBeingEdited",
            "_tempKey",
            "_parentTempKey",
            "amountFormatted",
            "totalAmountPaidFormatted",
            "originalAmount",
          ];
          uiKeys.forEach((key) => delete cleaned[key]);

          if (type !== "projects") delete cleaned.projectName;
          if (type !== "vendors") {
            delete cleaned.vendorName;
            delete cleaned.vendorNameAbbr;
            delete cleaned.vendorNo;
          }
          if (type !== "contracts") {
            delete cleaned.contractNo;
            delete cleaned.contractSystemNo;
            delete cleaned.code;
            delete cleaned.department;
          }

          if (cleaned.installments && Array.isArray(cleaned.installments)) {
            cleaned.installments = cleaned.installments.map((inst) =>
              cleanItem(inst, "installment")
            );
          }

          return cleaned;
        };

        const optimizedData = {
          type: "ProjectBackup",
          version: "2.0",
          exportedAt: new Date().toISOString(),

          projects: rawData.projects,
          vendors: rawData.vendors,
          banks: rawData.banks,

          contracts: rawData.contracts.map((c) =>
            cleanItem(c, "contracts")
          ),
          cpcItems: rawData.cpcItems.map((c) => cleanItem(c, "cpcItems")),
          installments: rawData.installments.map((i) =>
            cleanItem(i, "installments")
          ),
          bonds: rawData.bonds.map((b) => cleanItem(b, "bonds")),
          cpcDetailRows: rawData.cpcDetailRows.map((r) =>
            cleanItem(r, "cpcDetailRows")
          ),
          categories: rawData.categories,
        };

        const blob = new Blob([JSON.stringify(optimizedData)], {
          type: "application/json",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cpc_data_backup_opt_${appUtils.format.date(
          new Date()
        )}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast(this.t("fileSaveSuccess"), "success");
      },
      debounce(func, delay) {
        let timeout;
        return function (...args) {
          const context = this;
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(context, args), delay);
        };
      },
      initializeFuse() {
        const contractList = this.contracts.map((item) => {
          const project = this.projectMap.get(item.projectId) || {};
          const vendor = this.vendorMap.get(item.vendorId) || {};
          const searchableString = [
            item.contractNo,
            vendor.name,
            project.name,
            item.description,
          ].join(" ");
          const dashboardItem =
            this.contractDashboardData.find((d) => d.id === item.id) || {};
          return {
            ...item,
            ...dashboardItem,
            type: "CONTRACT",
            projectName: project.name || "",
            vendorName: vendor.name || "",
            searchLabel: item.contractNo,
            searchSublabel: `${project.name || "N/A"} | ${vendor.name || "N/A"
              }`,
            normalizedSearchableString:
              appUtils.text.normalizeVietnamese(searchableString),
          };
        });

        const cpcList = this.processedCpcData.map((item) => {
          const searchableString = [
            item.cpcIdentifier,
            item.contractNo,
            item.vendorName,
            item.projectName,
            item.contents,
          ].join(" ");
          const cpcNumberMatch = item.cpcIdentifier
            ? item.cpcIdentifier.match(/\d+$/)
            : null;
          const cpcNumber = cpcNumberMatch
            ? parseInt(cpcNumberMatch[0], 10)
            : 0;

          return {
            ...item,
            type: "CPC",
            searchLabel: `${item.projectName} | ${item.cpcIdentifier} - ${item.contents}`,
            searchSublabel: `${item.contractNo} | ${item.vendorNameAbbr}`,
            normalizedSearchableString:
              appUtils.text.normalizeVietnamese(searchableString),
            cpcNumber: cpcNumber,
          };
        });

        const vendorList = this.vendors.map((vendor) => {
          const searchableString = [
            vendor.name,
            vendor.vendorNo,
            vendor.abbrName,
          ].join(" ");
          return {
            ...vendor,
            type: "VENDOR",
            searchLabel: vendor.name,
            searchSublabel: `Mã NCC: ${vendor.vendorNo}`,
            normalizedSearchableString:
              appUtils.text.normalizeVietnamese(searchableString),
          };
        });

        const actionList = this.commandActions.map((action) => ({
          ...action,
          type: "ACTION",
          normalizedSearchableString: appUtils.text.normalizeVietnamese(
            `${action.searchLabel} ${action.searchSublabel}`
          ),
        }));

        const listToSearch = [
          ...cpcList,
          ...contractList,
          ...vendorList,
          ...actionList,
        ];

        const options = {
          includeScore: true,
          minMatchCharLength: 2,
          threshold: 0.4,
          ignoreLocation: true,
          keys: [{ name: "normalizedSearchableString", weight: 1.0 }],
        };

        this.fuseInstance = new Fuse(listToSearch, options);
      },
      performSearch(term) {
        if (!this.fuseInstance || !term || term.length < 1) {
          this.commandSearchResults = [];
          return;
        }

        this.isSearching = true;
        const normalizedSearchTerm =
          appUtils.text.normalizeVietnamese(term);

        setTimeout(() => {
          const fuseResults =
            this.fuseInstance.search(normalizedSearchTerm);

          let finalResults = [];
          const limits = { CPC: 4, CONTRACT: 4, VENDOR: 2 };
          const MAX_TOTAL_RESULTS = 10;
          const addedIds = new Set();

          const cpcGroupedByContract = new Map();
          fuseResults.forEach((result) => {
            const item = result.item;
            if (item.type === "CPC") {
              if (!cpcGroupedByContract.has(item.contractId)) {
                cpcGroupedByContract.set(item.contractId, []);
              }
              cpcGroupedByContract.get(item.contractId).push(item);
            }
          });

          cpcGroupedByContract.forEach((cpcList) => {
            cpcList.sort((a, b) => b.cpcNumber - a.cpcNumber);
          });

          const otherResults = fuseResults
            .filter((result) => result.item.type !== "CPC")
            .map((r) => r.item);

          let cpcPool = Array.from(cpcGroupedByContract.values())
            .map((group) => group.shift())
            .filter(Boolean);
          let contractPool = otherResults.filter(
            (r) => r.type === "CONTRACT"
          );
          let vendorPool = otherResults.filter((r) => r.type === "VENDOR");
          let actionPool = otherResults.filter((r) => r.type === "ACTION");

          let cpcAdded = 0,
            contractAdded = 0,
            vendorAdded = 0;

          actionPool.forEach((item) => {
            if (
              finalResults.length < MAX_TOTAL_RESULTS &&
              !addedIds.has(item.id)
            ) {
              finalResults.push(this.createCommandResult(item));
              addedIds.add(item.id);
            }
          });

          while (finalResults.length < MAX_TOTAL_RESULTS) {
            let itemAddedInLoop = false;

            if (
              contractAdded < limits.CONTRACT &&
              contractPool.length > 0
            ) {
              const item = contractPool.shift();
              if (item && !addedIds.has(item.id)) {
                finalResults.push(this.createCommandResult(item));
                addedIds.add(item.id);
                contractAdded++;
                itemAddedInLoop = true;
              }
            }

            if (
              finalResults.length < MAX_TOTAL_RESULTS &&
              cpcAdded < limits.CPC &&
              cpcPool.length > 0
            ) {
              const item = cpcPool.shift();
              if (item && !addedIds.has(item.id)) {
                finalResults.push(this.createCommandResult(item));
                addedIds.add(item.id);
                cpcAdded++;
                itemAddedInLoop = true;
              }
            }

            if (
              finalResults.length < MAX_TOTAL_RESULTS &&
              vendorAdded < limits.VENDOR &&
              vendorPool.length > 0
            ) {
              const item = vendorPool.shift();
              if (item && !addedIds.has(item.id)) {
                finalResults.push(this.createCommandResult(item));
                addedIds.add(item.id);
                vendorAdded++;
                itemAddedInLoop = true;
              }
            }

            if (!itemAddedInLoop) break;
          }

          const typeOrder = { ACTION: 1, CONTRACT: 2, CPC: 3, VENDOR: 4 };

          finalResults.sort((a, b) => {
            const orderA = typeOrder[a.type.toUpperCase()] || 99;
            const orderB = typeOrder[b.type.toUpperCase()] || 99;
            if (orderA !== orderB) {
              return orderA - orderB;
            }
            return a.label.localeCompare(b.label, undefined, {
              numeric: true,
            });
          });

          this.commandSearchResults = finalResults;
          this.isSearching = false;
        }, 0);
      },

      createCommandResult(item) {
        const itemType = item.type.toUpperCase();
        let action = () => { };

        switch (itemType) {
          case "CPC":
            action = () => this.goToCpc(item);
            break;
          case "CONTRACT":
            action = () => this.goToContract(item);
            break;
          case "VENDOR":
            action = () => this.goToVendor(item);
            break;
          case "ACTION":
            action = item.action;
            break;
        }

        return {
          id: item.id || item.searchLabel,
          type: item.type,
          label: item.searchLabel,
          sublabel: item.searchSublabel,
          financialInfo: "",
          action: action,
          payload: item,
        };
      },
      async saveModal() {
        if (!this.currentEditItem) return;

        const dateFieldsToValidate = ["receivedDate", "paymentDueDate"];
        if (
          !this.validateDates(this.currentEditItem, dateFieldsToValidate)
        ) {
          return;
        }

        if (
          this.currentEditItem.installments.some(
            (inst) => inst.amount > 0 && !inst.date && !inst.isSwap
          )
        ) {
          this.currentEditItem.installments.forEach((inst) => {
            inst.isDateInvalid =
              inst.amount > 0 && !inst.date && !inst.isSwap;
          });
          this.showToast(this.t("errorPaymentDate"), "error");
          return;
        }

        const totalPaid = (this.currentEditItem.installments || [])
          .filter((i) => !i.isSwap)
          .reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const cpcAmount = this.currentEditItem.amount;
        let validationError = false;
        if (cpcAmount >= 0) {
          if (totalPaid > cpcAmount) {
            validationError = true;
          }
        } else {
          if (totalPaid < 0 || totalPaid > Math.abs(cpcAmount)) {
            validationError = true;
          }
        }
        if (!this.currentEditItem.isUsd && validationError) {
          let errorMessage;
          if (cpcAmount >= 0) {
            errorMessage = this.t("errorPaymentExceedsDetails", {
              totalPaid: appUtils.format.currency(totalPaid),
              cpcAmount: appUtils.format.currency(cpcAmount),
              overExcessAmount: appUtils.format.currency(
                totalPaid - cpcAmount
              ),
            });
          } else {
            errorMessage = this.t("errorPaymentExceedsDetailsNegative", {
              totalPaid: appUtils.format.currency(totalPaid),
              cpcAmount: appUtils.format.currency(cpcAmount),
              absAmount: appUtils.format.currency(Math.abs(cpcAmount)),
            });
          }
          this.showToast(errorMessage, "error");
          return;
        }

        if (
          !this.currentEditItem.projectName ||
          !this.currentEditItem.vendorName
        ) {
          this.showToast(this.t("errorProjectVendorRequired"), "error");
          return;
        }
        const cpcValidationErrors = validateCpcInput(this.currentEditItem);
        if (cpcValidationErrors.length > 0) {
          this.showToast(cpcValidationErrors[0], "error");
          return;
        }

        const cpcSnapshot = JSON.parse(
          JSON.stringify(this.currentEditItem)
        );
        const originalModalMode = this.modalMode;
        this.closeModal();

        try {
          const { cpcDataToProcess, createdContract } = await saveCpcWithRelations(
            databaseService,
            cpcSnapshot,
            originalModalMode
          );
          if (createdContract) {
            this.showToast(this.t("contractCreatedAutomatically"), "info");
          }

          const freshData = await databaseService.getAllData();
          this._loadState(freshData);

          this.triggerReactivity();

          this.showToast(this.t("changesSavedSuccess"), "success");

          this.$nextTick(() => {
            this.syncPaymentsToDetails(
              cpcDataToProcess.contractId,
              cpcDataToProcess.id
            );
            this.syncTrackingToDetails(cpcDataToProcess);
            this.highlightAndScrollToItem(cpcDataToProcess.id);
            this.initializeFuse();
          });
        } catch (error) {
          console.error("Lỗi nghiêm trọng khi lưu CPC:", error);
          this.showToast(this.t("errorSavingCpc"), "error");

          const freshData = await databaseService.getAllData();
          this._loadState(freshData);
        }
      },

      async _findOrCreateEntity(
        entityArray,
        propertyName,
        value,
        tableName
      ) {
        const trimmedValue = value.trim();
        let entity = entityArray.find(
          (e) =>
            e[propertyName].trim().toLowerCase() ===
            trimmedValue.toLowerCase()
        );
        if (!entity) {
          const newEntity = { [propertyName]: trimmedValue };
          const newId = await databaseService.db[tableName].add(newEntity);
          entity = { id: newId, ...newEntity };
          entityArray.push(entity);
        }
        return entity;
      },
      autoFillFromMasterContract() {
        if (!this.currentEditItem || !this.currentEditItem.contractNo) {
          return;
        }

        const normalizedInputContractNo = this.currentEditItem.contractNo
          .trim()
          .toLowerCase();

        if (
          !normalizedInputContractNo ||
          normalizedInputContractNo === "n/a"
        ) {
          return;
        }

        const masterContract = this.contractByNumberMap.get(
          normalizedInputContractNo
        );

        if (masterContract) {
          const project =
            this.projectMap.get(masterContract.projectId) || {};
          const vendor = this.vendorMap.get(masterContract.vendorId) || {};

          this.currentEditItem.projectName = project.name || "";
          this.currentEditItem.vendorName = vendor.name || "";
          this.currentEditItem.code = masterContract.code || "";
          this.currentEditItem.department = masterContract.department || "";
          this.currentEditItem.contractSystemNo =
            masterContract.contractSystemNo || "";
          this.currentEditItem.vendorNo = vendor.vendorNo || "";
          this.currentEditItem.glAccount = masterContract.glAccount || "";
          this.currentEditItem.isUsd = masterContract.currency === "USD";
          this.showToast(this.t("contractDataAutoFilled"), "info");
        } else {
          if (typeof this.currentEditItem.vendorNo === "undefined") {
            this.currentEditItem.vendorNo = "";
          }
        }
      },

      initializeCalculationEngine() {
        const formulas = {
          contractVat: {
            manualFlag: "isContractVatManual",
            calculate: (row, context) => {
              if (context.isUsdContract) return 0;

              return Math.round(
                ((row.contractAmount || 0) + (row.contractVon || 0)) *
                ((row.contractPercentVat || 0) / 100)
              );
            },
          },

          contractTotal: {
            calculate: (row) =>
              Number(row.contractAmount || 0) +
              Number(row.contractVon || 0) +
              Number(row.contractVat || 0),
          },

          invoiceTotal: {
            calculate: (row) =>
              Number(row.invoiceAmount || 0) +
              Number(row.invoiceVat || 0),
          },

          invoiceAmountVND: {
            calculate: (row, context) =>
              context.isUsdContract
                ? Math.round(
                  (row.invoiceAmount || 0) *
                  (row.invoiceExchangeRate || 0)
                )
                : 0,
          },

          cpcPaymentOfWorkdone: {
            manualFlag: "isPoWManual",
            calculate: (row) =>
              Math.round(
                (row.cpcWorkDone || 0) * ((row.cpcPercentPoW || 0) / 100)
              ),
          },

          cpcAdvance: {
            manualFlag: "isAdvanceManual",
            calculate: (row, context) => {
              let baseAmount = 0;
              if (context.tableData && context.tableData.length > 0) {
                const relevantRows = row.phaseId
                  ? context.tableData.filter(
                    (r) => r.phaseId === row.phaseId
                  )
                  : context.tableData;

                const firstRow = relevantRows[0];
                baseAmount =
                  (firstRow?.contractAmount || 0) +
                  (firstRow?.contractVon || 0);
              }

              return Math.round(
                baseAmount * ((row.cpcPercentAdv || 0) / 100)
              );
            },
          },

          cpcVat: {
            manualFlag: "isVatManual",
            calculate: (row, context) => {
              if (row.isVatManual) {
                return row.cpcVat;
              }
              const vatRateToUse =
                row.cpcPercentVat ??
                (context.contractSettings?.defaultVatRate || 8);

              return Math.round(
                (row.cpcWorkDone || 0) * (vatRateToUse / 100)
              );
            },
          },

          cpcRepayment: {
            manualFlag: "isRepaymentManual",
            calculate: (row, context) => {
              if (
                row.cpcNo &&
                row.cpcNo.trim() !== "" &&
                !row._isBeingEdited
              )
                return row.cpcRepayment;
              if (row.isRepaymentManual) return row.cpcRepayment;
              if (
                !row.cpcNo &&
                !row.cpcWorkDone &&
                !row.cpcPaymentOfWorkdone
              )
                return 0;

              const { tableData, rowIndex, contractSettings } = context;
              if (!tableData) return 0;

              let relevantData = tableData;
              let adjustedRowIndex = rowIndex;

              if (row.phaseId) {
                relevantData = tableData.filter(
                  (r) => r.phaseId === row.phaseId
                );

                adjustedRowIndex = relevantData.findIndex(
                  (r) => r.id === row.id
                );

                if (adjustedRowIndex === -1)
                  adjustedRowIndex = relevantData.length;
              }

              const repaymentThreshold =
                (contractSettings.repaymentThreshold || 80) / 100;

              if ((row.cpcAdvance || 0) > 0) return 0;

              const totalAdvanceInPhase = relevantData.reduce(
                (sum, r) => sum + (Number(r.cpcAdvance) || 0),
                0
              );

              const totalRepaymentBefore = relevantData
                .slice(0, adjustedRowIndex)
                .reduce(
                  (sum, r) => sum + Math.abs(Number(r.cpcRepayment) || 0),
                  0
                );

              const remainingAdvanceToCollect =
                totalAdvanceInPhase - totalRepaymentBefore;

              if (remainingAdvanceToCollect <= 0) return 0;

              let finalValue = 0;

              if (row.isFinalSettlement) {
                finalValue = -1 * Math.round(remainingAdvanceToCollect);
              } else {
                const cumulativeWorkDone = relevantData
                  .slice(0, adjustedRowIndex + 1)
                  .reduce(
                    (sum, r) => sum + (Number(r.cpcWorkDone) || 0),
                    0
                  );

                const cumulativePoW = relevantData
                  .slice(0, adjustedRowIndex + 1)
                  .reduce(
                    (sum, r) => sum + (Number(r.cpcPaymentOfWorkdone) || 0),
                    0
                  );

                const valueToUse = row.useWorkdoneForRepayment
                  ? cumulativeWorkDone
                  : cumulativePoW;

                let basisItemIds = row.repaymentBasisItems;

                if (
                  !basisItemIds ||
                  !Array.isArray(basisItemIds) ||
                  basisItemIds.length === 0
                ) {
                  basisItemIds = relevantData
                    .slice(0, adjustedRowIndex + 1)
                    .filter(
                      (r) =>
                        (Number(r.contractAmount) || 0) +
                        (Number(r.contractVon) || 0) >
                        0
                    )
                    .map((r) => r.id);
                }

                const totalContractValue = relevantData
                  .filter((r) => basisItemIds.includes(r.id))
                  .reduce(
                    (sum, r) =>
                      sum +
                      (Number(r.contractAmount) || 0) +
                      (Number(r.contractVon) || 0),
                    0
                  );

                let totalRepaymentTarget = 0;
                if (totalContractValue > 0) {
                  const thresholdValue =
                    repaymentThreshold * totalContractValue;
                  if (thresholdValue > 0) {
                    totalRepaymentTarget =
                      (totalAdvanceInPhase * valueToUse) / thresholdValue;
                  }
                }

                const repaymentThisPeriod =
                  totalRepaymentTarget - totalRepaymentBefore;

                const actualRepayment = Math.min(
                  repaymentThisPeriod,
                  remainingAdvanceToCollect
                );

                finalValue = -1 * Math.round(Math.max(0, actualRepayment));
              }

              return finalValue;
            },
          },

          cpcAmountDue: {
            calculate: (row) =>
              Number(row.cpcPaymentOfWorkdone || 0) +
              Number(row.cpcAdvance || 0) +
              Number(row.cpcRepayment || 0) +
              Number(row.cpcRetention || 0) +
              Number(row.cpcOtherDeduction || 0),
          },

          remainingPayable: {
            isSummary: true,
            calculate: (row, context) => {
              const totalDue = context.isUsdContract
                ? row.invoiceTotal || 0
                : row.invoiceTotal || 0;
              const totalPaid = context.isUsdContract
                ? row.paymentTotalAmountUsd || 0
                : row.paymentGrandTotal || 0;
              return Math.round(totalDue - totalPaid);
            },
          },
          contractRemainingInclVat: {
            isSummary: true,
            calculate: (row, context) => {
              const totalDue = context.isUsdContract
                ? row.contractTotal || 0
                : row.contractTotal || 0;
              const totalPaid = context.isUsdContract
                ? row.paymentTotalAmountUsd || 0
                : row.paymentGrandTotal || 0;
              return Math.round(totalDue - totalPaid);
            },
          },
          contractRemainingExclVat: {
            isSummary: true,
            calculate: (row, context) => {
              const totalDue =
                (row.contractAmount || 0) + (row.contractVon || 0);
              const totalPaid = row.paymentTotalAmount || 0;
              return Math.round(totalDue - totalPaid);
            },
          },
          contractRemainingVat: {
            isSummary: true,
            calculate: (row, context) => {
              const totalDue = row.contractVat || 0;
              const totalPaid = row.paymentTotalVat || 0;
              return Math.round(totalDue - totalPaid);
            },
          },
        };

        this.calculationEngine = {
          formulas,
          calculationOrder: [
            "contractVat",
            "contractTotal",
            "invoiceTotal",
            "invoiceAmountVND",
            "cpcPaymentOfWorkdone",
            "cpcAdvance",
            "cpcRepayment",
            "cpcAmountDue",
            "cpcVat",
          ],
          summaryOrder: [
            "remainingPayable",
            "contractRemainingInclVat",
            "contractRemainingExclVat",
            "contractRemainingVat",
          ],
        };
      },
      runCalculationEngine(tableData, contract, startIndex = 0) {
        if (!this.calculationEngine) return tableData;

        if (!contract) {
          console.error(
            "Lỗi nghiêm trọng: runCalculationEngine được gọi mà không có thông tin hợp đồng."
          );
          return tableData;
        }
        const context = {
          isUsdContract: contract?.currency === "USD",
          contractSettings:
            contract?.settings || this.defaultNewContractItem.settings,
        };

        for (let i = startIndex; i < tableData.length; i++) {
          const row = tableData[i];
          context.rowIndex = i;
          context.tableData = tableData;

          this.calculationEngine.calculationOrder.forEach((field) => {
            const formula = this.calculationEngine.formulas[field];
            const isManual = formula.manualFlag && row[formula.manualFlag];

            if (!isManual) {
              row[field] = formula.calculate(row, context);
            }
          });
        }

        tableData.forEach((row, i) => {
          context.rowIndex = i;
          context.tableData = tableData;
          this.calculationEngine.summaryOrder.forEach((field) => {
            const formula = this.calculationEngine.formulas[field];
            row[field] = formula.calculate(row, context);
          });
        });

        return tableData;
      },
      recalculateDetailsTable(tableData, contractId) {
        if (!tableData || !Array.isArray(tableData)) return tableData;
        return this.runCalculationEngine(tableData);
      },
      updateFormulasInModal(changedField, isManual = false) {
        if (!this.currentDetailItem || this.isModalInitializing) return;

        const formula = this.calculationEngine.formulas[changedField];
        if (formula?.manualFlag) {
          this.currentDetailItem[formula.manualFlag] = isManual;
        }

        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        const rowIndex = this.cpcDetailRows
          .filter((r) => r.contractId === contractId)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .findIndex((r) => r.id === this.currentDetailItem.id);

        if (rowIndex === -1) {
          console.error(
            "Không thể tìm thấy chỉ số của dòng đang sửa. Hủy tính toán."
          );
          return;
        }

        const tempTableData = this.cpcDetailRows
          .filter((r) => r.contractId === contractId)
          .map((r) => JSON.parse(JSON.stringify(r)))
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        if (tempTableData[rowIndex]) {
          Object.assign(tempTableData[rowIndex], this.currentDetailItem);
        }

        const updatedTable = this.runCalculationEngine(
          tempTableData,
          this.selectedContractDetails,
          0
        );

        if (updatedTable[rowIndex]) {
          const fieldsToUpdate = [
            ...this.calculationEngine.calculationOrder,
            ...this.calculationEngine.summaryOrder,
          ];
          for (const field of fieldsToUpdate) {
            this.currentDetailItem[field] = updatedTable[rowIndex][field];
          }
        }
      },
      _setupDetailItemForEdit(item, index) {
        if (this.viewStates.cpcDetails.activePhaseId === "summary") {
          const hasPhases =
            (this.selectedContractDetails?.phases?.length || 0) > 0;
          if (hasPhases) {
            this.showToast(
              "Hợp đồng này có chia Giai đoạn. Vui lòng chọn Tab Giai đoạn cụ thể để chỉnh sửa.",
              "warning"
            );
            return;
          }
        }

        this.isModalInitializing = true;
        this.currentDetailItem = JSON.parse(JSON.stringify(item));
        this.currentDetailItem._isBeingEdited = true;
        this.currentDetailIndex = index;

        if (this.calculationEngine && this.selectedContractDetails) {
          const tempTable = [this.currentDetailItem];

          const contextTable = this.cpcDetailRows.filter(
            (r) => r.contractId === this.selectedContractDetails.id
          );

          const context = {
            isUsdContract: this.selectedContractDetails?.currency === "USD",
            contractSettings:
              this.selectedContractDetails?.settings ||
              this.defaultNewContractItem.settings,
            rowIndex: index,
            tableData: contextTable,
          };

          this.calculationEngine.calculationOrder.forEach((field) => {
            const formula = this.calculationEngine.formulas[field];
            const isManual =
              formula.manualFlag &&
              this.currentDetailItem[formula.manualFlag];
            if (!isManual) {
              this.currentDetailItem[field] = formula.calculate(
                this.currentDetailItem,
                context
              );
            }
          });
        }

        this.$nextTick(() => {
          this.isModalInitializing = false;
        });
      },
      toggleRepaymentBasis(basisId) {
        if (!this.currentDetailItem) return;
        if (
          this.currentDetailItem.repaymentBasisItems === null ||
          this.currentDetailItem.repaymentBasisItems === undefined
        ) {
          this.currentDetailItem.repaymentBasisItems = [];
        }

        const index =
          this.currentDetailItem.repaymentBasisItems.indexOf(basisId);
        if (index > -1) {
          this.currentDetailItem.repaymentBasisItems.splice(index, 1);
        } else {
          this.currentDetailItem.repaymentBasisItems.push(basisId);
        }

        this.updateFormulasInModal("cpcRepayment", false);
      },
      toggleFilterPanel(viewState) {
        viewState.isFilterCollapsed = !viewState.isFilterCollapsed;
      },
      activeFiltersSummary(viewState) {
        const summaries = [];
        const filter = viewState.filter;

        const addSummaryById = (labelKey, ids, sourceArray) => {
          if (ids && ids.length > 0) {
            const names = ids
              .map(
                (id) =>
                  sourceArray.find((item) => item.id === id)?.name || id
              )
              .join(", ");
            summaries.push(`${this.t(labelKey)}: ${names}`);
          }
        };
        const addSummaryByContractId = (labelKey, ids) => {
          if (ids && ids.length > 0) {
            const names = ids
              .map(
                (id) =>
                  this.contracts.find((item) => item.id === id)
                    ?.contractNo || id
              )
              .join(", ");
            summaries.push(`${this.t(labelKey)}: ${names}`);
          }
        };
        const addSummaryByValue = (labelKey, values) => {
          if (values && values.length > 0) {
            summaries.push(`${this.t(labelKey)}: ${values.join(", ")}`);
          }
        };

        addSummaryById("project", filter.projectId, this.projects);
        addSummaryById("vendor", filter.vendorId, this.vendors);
        addSummaryByContractId("contract", filter.contractId);
        addSummaryByValue(
          "status",
          filter.status?.map((s) =>
            this.t(s.toLowerCase().replace(/ /g, ""))
          )
        );
        addSummaryByValue("code", filter.code);
        addSummaryByValue("paymentSource", filter.paymentSource);
        addSummaryByValue("vendorSWAP", filter.vendorSWAP);
        addSummaryByValue("bondType", filter.bondType);
        addSummaryByValue("status", filter.status);

        if (filter.startDate && filter.endDate) {
          summaries.push(
            `${this.t("dateRange")}: ${filter.startDate} → ${filter.endDate
            }`
          );
        }

        return summaries.length > 0
          ? summaries.join("; ")
          : this.t("noActiveFilters");
      },
      handleGlobalKeyDown(event) {
        this.handlePaginationShortcut(event);
        if ((event.ctrlKey || event.metaKey) && event.key === "i") {
          event.preventDefault();
          this.toggleCommandPalette();
        }

        if (event.altKey && event.key.toLowerCase() === "p") {
          if (this.currentTab === "cpc-tracking") {
            event.preventDefault();
            this.toggleProjectQuickFilter();
          }
        }

        if (event.altKey && event.key.toLowerCase() === "c") {
          event.preventDefault();
          this.clearAllFilters();
        }

        if (event.key === "/") {
          const target = event.target;
          if (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT"
          ) {
            return;
          }

          if (this.currentTab === "cpc-tracking") {
            event.preventDefault();
            this.$nextTick(() => {
              const searchInput = this.$refs.cpcSearchInput;
              if (searchInput) {
                searchInput.focus();
                searchInput.select();
              }
            });
          } else if (this.currentTab === "master-data") {
            event.preventDefault();
            this.$nextTick(() => {
              let searchInput = null;

              if (this.masterData.activeSubTab === "vendors") {
                searchInput = this.$refs.vendorSearchInput;
              } else if (this.masterData.activeSubTab === "projects") {
                searchInput = this.$refs.projectSearchInput;
              }

              if (searchInput) {
                searchInput.focus();
                searchInput.select();
              }
            });
          } else if (this.currentTab === "vendor-balance") {
            event.preventDefault();
            this.$nextTick(() => {
              const searchInput = this.$refs.vendorBalanceSearchInput;
              if (searchInput) {
                searchInput.focus();
                searchInput.select();
              }
            });
          }
          else if (this.currentTab === "vendor-partner") {
            event.preventDefault();
            this.$nextTick(() => {
              const searchInput = this.$refs.vendorPartnerSearchInput;
              if (searchInput) {
                searchInput.focus();
                searchInput.select();
              }
            });
          }
        }

        if (event.altKey && event.key.toLowerCase() === "n") {
          event.preventDefault();
          this.toggleNotificationDropdown();
        }
        if (event.key === "Escape" && this.isNotesModalVisible) {
          this.closeNotesModal();
        }
      },
      toggleCommandPalette(forceState = null) {
        this.isCommandPaletteVisible =
          forceState !== null ? forceState : !this.isCommandPaletteVisible;
        if (this.isCommandPaletteVisible) {
          this.commandSearchTerm = "";
          this.activeCommandIndex = 0;
          this.$nextTick(() => {
            this.$refs.commandInput?.focus();
          });
        }
      },
      navigateCommands(direction) {
        if (this.commandResults.length === 0) return;
        if (direction === "down") {
          this.activeCommandIndex =
            (this.activeCommandIndex + 1) % this.commandResults.length;
        } else if (direction === "up") {
          this.activeCommandIndex =
            (this.activeCommandIndex - 1 + this.commandResults.length) %
            this.commandResults.length;
        }

        this.$nextTick(() => {
          const list = this.$refs.commandInput
            ?.closest(".command-palette-dialog")
            ?.querySelector(".command-results-list");
          const activeItem = list?.querySelector(
            ".command-result-item.active"
          );

          if (activeItem) {
            activeItem.scrollIntoView({
              block: "nearest",
            });
          }
        });
      },
      executeActiveCommand() {
        if (this.commandResults[this.activeCommandIndex]) {
          this.executeCommand(this.commandResults[this.activeCommandIndex]);
        }
      },
      executeCommand(command) {
        if (typeof command.action === "function") {
          command.action();
        }
        this.toggleCommandPalette(false);
      },
      goToCpc(payload) {
        this.currentTab = "cpc-tracking";
        const filters = this.viewStates.cpcTracking.filter;
        filters.projectId = payload.projectId ? [payload.projectId] : [];
        this.$nextTick(() => {
          filters.vendorId = payload.vendorId ? [payload.vendorId] : [];
          this.$nextTick(() => {
            filters.contractId = payload.contractId
              ? [payload.contractId]
              : [];
            filters.status = [];
            this.$nextTick(() => {
              this.highlightAndScrollToItem(payload.id);
            });
          });
        });
      },
      goToContract(payload) {
        this.currentTab = "cpc-details";
        const filters = this.viewStates.cpcDetails.filter;
        filters.projectId = payload.projectId ? [payload.projectId] : [];
        this.$nextTick(() => {
          filters.vendorId = payload.vendorId ? [payload.vendorId] : [];
          this.$nextTick(() => {
            filters.selectedContractId = payload.id;
          });
        });
      },
      goToVendor(payload) {
        this.currentTab = "master-data";
        this.masterData.activeSubTab = "vendors";
        this.masterData.vendors.searchTerm = payload.name;
        this.toggleCommandPalette(false);
      },
      goToContractDetails(item) {
        if (!item.projectId || !item.vendorId || !item.contractId) {
          this.showToast(
            "Project, Vendor, or Contract information is missing.",
            "warning"
          );
          return;
        }

        this.viewStates.cpcDetails.filter.projectId = [item.projectId];
        this.viewStates.cpcDetails.filter.vendorId = [item.vendorId];

        this.$nextTick(() => {
          this.viewStates.cpcDetails.filter.selectedContractId =
            item.contractId;
          this.currentTab = "cpc-details";
        });
      },
      goToContractDetailsFromDashboard(item) {
        const contractId = item.contractId || item.id;
        const contract = this.contracts.find((c) => c.id === contractId);
        if (!contract || !contract.projectId || !contract.vendorId) {
          this.showToast(
            "Project, Vendor, or Contract information is missing.",
            "warning"
          );
          return;
        }
        this.viewStates.cpcDetails.filter.projectId = [contract.projectId];
        this.viewStates.cpcDetails.filter.vendorId = [contract.vendorId];

        this.$nextTick(() => {
          this.viewStates.cpcDetails.filter.selectedContractId =
            contract.id;
          this.currentTab = "cpc-details";
        });
      },
      _prepareEditItem(item) {
        this.currentEditItem = JSON.parse(JSON.stringify(item));

        if (
          (!this.currentEditItem.vendorNo ||
            this.currentEditItem.vendorNo === "N/A") &&
          this.currentEditItem.vendorId
        ) {
          const vendor = this.vendorMap.get(this.currentEditItem.vendorId);
          if (vendor) {
            this.currentEditItem.vendorNo = vendor.vendorNo;
            this.currentEditItem.vendorName = vendor.name;
            if (!this.currentEditItem.vendorNameAbbr) {
              this.currentEditItem.vendorNameAbbr = vendor.abbrName;
            }
          }
        }

        this.currentEditItem.cpcIdentifier =
          this.currentEditItem.cpcIdentifier || this.currentEditItem.cpc;

        this.currentEditItem.displayAmountExclVAT = (
          this.currentEditItem.amountExclVAT || 0
        ).toLocaleString("vi-VN");
        this.currentEditItem.displayVatAmount = (
          this.currentEditItem.vatAmount || 0
        ).toLocaleString("vi-VN");
        this.currentEditItem.displayAmount = (
          this.currentEditItem.amount || 0
        ).toLocaleString("vi-VN");
        this.currentEditItem.displayAmountUsd = (
          this.currentEditItem.amountUsd || 0
        ).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        this.currentEditItem.displayExchangeRate = (
          this.currentEditItem.exchangeRate || 0
        ).toLocaleString("vi-VN");

        (this.currentEditItem.installments || []).forEach((inst) => {
          inst.displayAmount = (inst.amount || 0).toLocaleString("vi-VN");
          if (inst.isUsd) {
            inst.displayAmountUsd = (inst.amountUsd || 0).toLocaleString(
              "en-US",
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            );
            inst.displayExchangeRate = (
              inst.exchangeRate || 0
            ).toLocaleString("vi-VN");
          }
          if (inst.swapPayments) {
            inst.swapPayments.forEach(
              (p) =>
                (p.displayAmount = (p.amount || 0).toLocaleString("vi-VN"))
            );
          }
        });

        this.autoFillFromMasterContract();
      },
      openFinancialsModal(item) {
        this._prepareEditItem(item);
        this.modalMode = "financials";

        this.shouldFocusPaymentDate = true;

        if (!this.currentEditItem.installments || this.currentEditItem.installments.length === 0) {
          this.addInstallment();
        }

        appUtils.ui.toggleModal("cpcDetailModal", "show");
      },
      toggleCurrencyDisplay(item) {
        const originalItem = this.cpcItems.find((d) => d.id === item.id);
        if (originalItem) {
          if (originalItem.displayAmountInUsd === undefined) {
            originalItem.displayAmountInUsd = false;
          }
          originalItem.displayAmountInUsd =
            !originalItem.displayAmountInUsd;
        }
      },
      exportReportToExcel() {
        if (this.reportData.length === 0) {
          this.showToast("Không có dữ liệu báo cáo để xuất.", "warning");
          return;
        }
        const wb = XLSX.utils.book_new();
        const ws_name = "Report Dashboard";
        const ws_data = [];
        const header1 = [
          this.t("category"),
          this.t("reportPaidToDateHeader", {
            date: this.formattedAsOfDate,
          }),
          null,
          null,
          this.t("reportRemainingFromDateHeader", {
            date: this.formattedAsOfDate,
          }),
          null,
          null,
          this.t("reportPaidInMonthHeader", {
            month: this.formattedReportMonth,
          }),
          null,
          null,
        ];
        const header2 = [
          null,
          "Net",
          "VAT",
          "Total",
          "Net",
          "VAT",
          "Total",
          "Net",
          "VAT",
          "Total",
        ];
        ws_data.push(header1, header2);

        const level1RowIndices = [];

        this.reportData.forEach((item, index) => {
          const excelRowIndex = ws_data.length + 1;
          const indent = " ".repeat((item.level - 1) * 4);

          const row = [
            `${indent}${item.code} ${item.name}`,
            item.metrics.paidToDate.net,
            item.metrics.paidToDate.vat,
            item.metrics.paidToDate.total,
            item.metrics.remaining.net,
            item.metrics.remaining.vat,
            item.metrics.remaining.total,
            item.metrics.paidInMonth.net,
            item.metrics.paidInMonth.vat,
            item.metrics.paidInMonth.total,
          ];

          if (item.level === 1) {
            level1RowIndices.push(excelRowIndex);

            let childCount = 0;
            for (let i = index + 1; i < this.reportData.length; i++) {
              if (this.reportData[i].level > 1) {
                childCount++;
              } else {
                break;
              }
            }

            if (childCount > 0) {
              const startChildRow = excelRowIndex + 1;
              const endChildRow = excelRowIndex + childCount;
              row[3] = {
                t: "n",
                f: `SUBTOTAL(9,B${startChildRow}:B${endChildRow})+SUBTOTAL(9,C${startChildRow}:C${endChildRow})`,
              };
              row[6] = {
                t: "n",
                f: `SUBTOTAL(9,E${startChildRow}:E${endChildRow})+SUBTOTAL(9,F${startChildRow}:F${endChildRow})`,
              };
              row[9] = {
                t: "n",
                f: `SUBTOTAL(9,H${startChildRow}:H${endChildRow})+SUBTOTAL(9,I${startChildRow}:I${endChildRow})`,
              };
              row[1] = {
                t: "n",
                f: `SUBTOTAL(9,B${startChildRow}:B${endChildRow})`,
              };
              row[2] = {
                t: "n",
                f: `SUBTOTAL(9,C${startChildRow}:C${endChildRow})`,
              };
              row[4] = {
                t: "n",
                f: `SUBTOTAL(9,E${startChildRow}:E${endChildRow})`,
              };
              row[5] = {
                t: "n",
                f: `SUBTOTAL(9,F${startChildRow}:F${endChildRow})`,
              };
              row[7] = {
                t: "n",
                f: `SUBTOTAL(9,H${startChildRow}:H${endChildRow})`,
              };
              row[8] = {
                t: "n",
                f: `SUBTOTAL(9,I${startChildRow}:I${endChildRow})`,
              };
            }
          }

          ws_data.push(row);
        });

        const footerRow = [this.t("grandTotal")];
        for (let i = 1; i <= 9; i++) {
          const colLetter = XLSX.utils.encode_col(i);
          const formula = `SUM(${level1RowIndices
            .map((r) => `${colLetter}${r}`)
            .join(",")})`;
          footerRow.push({ t: "n", f: formula });
        }
        ws_data.push(footerRow);
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const colWidths = [];
        ws_data.forEach((row) => {
          row.forEach((cell, i) => {
            const cellValue = cell
              ? cell.f
                ? "0".repeat(15)
                : cell.toString()
              : "";
            const currentLength = cellValue.length;
            if (!colWidths[i] || currentLength > colWidths[i]) {
              colWidths[i] = currentLength;
            }
          });
        });
        ws["!cols"] = colWidths.map((width) => ({ wch: width + 2 }));
        ws["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
          { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
          { s: { r: 0, c: 4 }, e: { r: 0, c: 6 } },
          { s: { r: 0, c: 7 }, e: { r: 0, c: 9 } },
        ];
        XLSX.utils.book_append_sheet(wb, ws, ws_name);
        const fileName = `Report_Dashboard_${this.viewStates.reportDashboard.reportMonth}.xlsx`;
        XLSX.writeFile(wb, fileName);

        this.showToast(`${this.t("btnExport")} thành công!`, "success");
      },
      printReport() {
        window.print();
      },
      getGroupColspan(groupKey, exceptKeys = []) {
        if (groupKey === "remainingPayable") {
          return this.viewStates.cpcDetails.columnVisibility
            .remainingPayable
            ? 1
            : 0;
        }

        if (!this.viewStates.cpcDetails.columnVisibility[groupKey])
          return 0;

        const subColumnsForGroup = this.detailsAllSubColumns.filter(
          (c) => c.group === groupKey
        );
        let visibleCount = 0;

        subColumnsForGroup.forEach((sc) => {
          if (
            this.viewStates.cpcDetails.subColumnVisibility[sc.key] &&
            !exceptKeys.includes(sc.key)
          ) {
            visibleCount++;
          }
        });

        return visibleCount > 0 ? visibleCount : 0;
      },
      getOrdinal(n) {
        if (this.language !== "en") return "";
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
      },
      handleSort(state, key) {
        if (state.sortBy === key) {
          state.sortDirection =
            state.sortDirection === "asc" ? "desc" : "asc";
        } else {
          state.sortBy = key;
          const descendingByDefault = [
            "receivedDate",
            "date",
            "paymentDueDate",
          ];
          state.sortDirection = descendingByDefault.includes(key)
            ? "desc"
            : "asc";
        }
      },
      toggleModal(modalId, action = "show") {
        const modalEl = document.getElementById(modalId);
        if (modalEl) {
          const modalInstance =
            bootstrap.Modal.getInstance(modalEl) ||
            new bootstrap.Modal(modalEl);
          if (action === "show") {
            modalInstance.show();
          } else if (action === "hide") {
            modalInstance.hide();
          }
        }
      },
      clearModalData(modalId) {
        switch (modalId) {
          case "cpcDetailModal":
            this.currentEditItem = null;
            this.modalMode = "edit";
            break;
          case "swapEditModal":
            this.currentEditSwap = null;
            break;
          case "contractDetailModal":
            this.currentEditContract = null;
            this.contractModalMode = "add";
            break;
          case "bondDetailViewModal":
            this.currentViewBondItem = null;
            break;
          case "bondEditModal":
            this.currentEditBond = null;
            break;
          case "installmentEditModal":
            this.currentEditInstallment = null;
            break;
          case "renewBondModal":
            this.currentRenewBond = null;
            this.newBondDetails = {
              bondNumber: "",
              ref: "",
              bondType: "",
              amount: 0,
              displayAmount: "",
              issueDate: "",
              expiryDate: "",
              issuingBank: "",
              isSettled: false,
              settlementReasonDisplay: "",
              renewedFromBondId: null,
              renewalNotes: "",
              renewalDate: "",
            };
            break;
          case "statusUpdateModal":
            this.currentStatusUpdate = null;
            break;
          case "contractDetailsModal":
          case "cpcDetailsModal":
          case "paymentDetailsModal":
          case "invoiceDetailsModal":
            this.currentDetailItem = null;
            this.currentDetailIndex = -1;
            this.showRepaymentBasisConfig = false;
            this.isVatOverrideVisible = false;
            this.isContractVatOverrideVisible = false;
            this.invoiceSelectedRowIds = [];
            break;
        }
      },

      toggleDetailsCurrencyView() {
        const currentView = this.viewStates.cpcDetails.currencyView;
        this.viewStates.cpcDetails.currencyView =
          currentView === "USD" ? "VND" : "USD";
      },
      toggleDetailRowExpand(item) {
        const originalItem = this.cpcDetailRows.find(
          (d) => d.id === item.id
        );
        if (originalItem) {
          originalItem.isExpanded = !originalItem.isExpanded;
        }
      },
      formatDetailsCurrency(value) {
        if (value === 0 || !value) return " - ";

        const isUsdContract = this.isCurrentContractUSD;
        const view = this.viewStates.cpcDetails.currencyView;

        if (isUsdContract && view === "USD") {
          return this.formatCurrencyUSD(value);
        }
        return appUtils.format.currency(value);
      },
      getStatusBadgeClass(status) {
        if (status === "Closed") {
          return "badge bg-secondary";
        }
        return "badge bg-primary";
      },
      async openStatusUpdateModal(contract) {
        if (!contract) return;
        this.currentStatusUpdate = {
          id: contract.id,
          status: contract.status || "Active",
          statusNote: contract.statusNote || "",
        };
        appUtils.ui.toggleModal("statusUpdateModal", "show");
      },
      closeStatusUpdateModal() {
        appUtils.ui.toggleModal("statusUpdateModal", "hide");
      },
      async saveStatusUpdate() {
        if (!this.currentStatusUpdate) return;
        const contractIndex = this.contracts.findIndex(
          (c) => c.id === this.currentStatusUpdate.id
        );
        if (contractIndex !== -1) {
          const contractToUpdate = JSON.parse(
            JSON.stringify(this.contracts[contractIndex])
          );
          contractToUpdate.status = this.currentStatusUpdate.status;
          contractToUpdate.statusNote = this.currentStatusUpdate.statusNote;

          try {
            await putContractRecord(databaseService, contractToUpdate);
            this.contracts[contractIndex] = contractToUpdate;
            this.showToast(this.t("contractStatusUpdated"), "success");
          } catch (error) {
            console.error("Error updating contract status:", error);
            this.showToast("Failed to update contract status.", "error");
          }
        }
        this.closeStatusUpdateModal();
      },
      downloadDetailsTemplate() {
        // Lấy hợp đồng đang chọn (nếu có)
        const selectedContractId = this.viewStates.cpcDetails.filter.selectedContractId;
        const selectedContract = this.contracts.find(c => c.id === selectedContractId);

        const headers = [
          "contractNo", "phaseName", "contractInfo", "description",
          "contractAmount", "contractVon", "contractPercentVat", "contractVat",
          "cpcNo", "cpcDueDate", "cpcWorkDone", "cpcPercentPoW",
          "cpcPaymentOfWorkdone", "cpcPercentAdv", "cpcAdvance",
          "cpcRepayment", "cpcRetention", "cpcOtherDeduction",
          "cpcPercentVat", "cpcVat", "invoiceNo", "invoiceDate",
          "invoicePostingDate", "invoiceAmount", "invoiceVat",
          "paymentDate", "paymentAmount"
        ];

        // Tạo dữ liệu mẫu nếu có hợp đồng đang chọn
        const data = selectedContract ? [{ "contractNo": selectedContract.contractNo }] : [];

        const ws = XLSX.utils.json_to_sheet(data, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Details");
        XLSX.writeFile(wb, `CPC_Details_Template.xlsx`);
      },

      triggerDetailsFileUpload() {
        this.$refs.uploadDetailsExcelInput.click();
      },
      async handleDetailsFileUpload(event) {
        if (!this.requirePermission("import.execute")) return;
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: null });

            if (jsonData.length === 0) return;

            // Gom nhóm theo contractNo
            const groupedData = jsonData.reduce((acc, row) => {
              const cNo = row.contractNo ? String(row.contractNo).trim() : "UNKNOWN";
              if (!acc[cNo]) acc[cNo] = [];
              acc[cNo].push(row);
              return acc;
            }, {});

            // Xác thực và chuẩn bị mapping
            const contractMapping = {};
            const invalidContracts = [];
            for (const cNo in groupedData) {
              if (cNo === "UNKNOWN") continue;
              const contract = this.contracts.find(c => c.contractNo.toLowerCase() === cNo.toLowerCase());
              if (contract) contractMapping[cNo] = contract;
              else invalidContracts.push(cNo);
            }

            if (invalidContracts.length > 0) {
              this.showToast(`Hợp đồng không tồn tại: ${invalidContracts.join(", ")}`, "error");
              return;
            }

            appUtils.ui.showConfirmation(this, {
              title: "Tải dữ liệu đa hợp đồng",
              message: `Xử lý <strong>${Object.keys(contractMapping).length}</strong> hợp đồng. Chọn phương thức:`,
              confirmButtonText: "Ghi đè tất cả",
              confirmButtonClass: "btn-danger",
              neutralButtonText: "Nối tiếp tất cả",
              onConfirm: () => this.processMultiContractUpload(groupedData, contractMapping, true),
              onNeutral: () => this.processMultiContractUpload(groupedData, contractMapping, false),
            });
          } catch (error) {
            console.error(error);
            this.showToast("Lỗi xử lý file.", "error");
          } finally { event.target.value = ""; }
        };
        reader.readAsArrayBuffer(file);
      },

      async processMultiContractUpload(groupedByContract, contractMapping, isOverwrite) {
        this.showToast("Đang đồng bộ dữ liệu Hợp đồng & Thanh toán...", "info");

        try {
          for (const cNo in groupedByContract) {
            const contract = contractMapping[cNo];
            const excelRows = groupedByContract[cNo];

            // --- 1. TỰ ĐỘNG TẠO PHASE ---
            if (!contract.phases) contract.phases = [];
            let contractChanged = false;
            excelRows.forEach(row => {
              const pName = row.phaseName ? String(row.phaseName).trim() : null;
              if (pName && !contract.phases.find(p => p.name === pName)) {
                contract.phases.push({ id: "phase_" + Date.now() + Math.random(), name: pName });
                contractChanged = true;
              }
            });
            if (contractChanged) await putContractRecord(databaseService, contract);

            // --- 2. GOM NHÓM THEO PHASE ĐỂ CHÈN DÒNG TRỐNG ---
            const rowsByPhase = {};
            excelRows.forEach(row => {
              const pName = row.phaseName ? String(row.phaseName).trim() : "Default";
              if (!rowsByPhase[pName]) rowsByPhase[pName] = [];
              rowsByPhase[pName].push(row);
            });

            const finalRowsToSave = [];
            const syncOnlyRows = [];

            // Duyệt từng Phase của Hợp đồng này
            for (const pName in rowsByPhase) {
              const phase = contract.phases.find(p => p.name === pName);
              const phaseId = phase ? phase.id : null;
              const pRows = rowsByPhase[pName];

              pRows.forEach(row => {
                const hasStructuralData = !!(
                  row.contractInfo ||
                  row.description ||
                  row.contractAmount ||
                  row.contractVon ||
                  row.contractVat ||
                  row.cpcWorkDone ||
                  row.cpcAdvance ||
                  row.cpcRepayment ||
                  row.cpcRetention ||      // Thêm kiểm tra này
                  row.cpcOtherDeduction ||  // Thêm kiểm tra này
                  row.invoiceNo
                );

                const newRow = this.createEmptyDetailRow(contract.id, 0);
                newRow.phaseId = phaseId;

                // --- DANH SÁCH TRƯỜNG SỐ CẦN UPDATE (Đã bổ sung các trường bạn yêu cầu) ---
                const numericKeys = [
                  "contractAmount", "contractVon", "contractPercentVat", "contractVat",
                  "cpcWorkDone", "cpcPercentPoW", "cpcPaymentOfWorkdone",
                  "cpcPercentAdv", "cpcAdvance", "cpcRepayment",
                  "cpcRetention", "cpcOtherDeduction", "cpcPercentVat", "cpcVat",
                  "invoiceAmount", "invoiceVat", "paymentAmount"
                ];

                for (const key in row) {
                  if (newRow.hasOwnProperty(key) || key === "paymentAmount") {
                    if (numericKeys.includes(key)) {
                      const val = Number(String(row[key] || 0).replace(/,/g, ""));
                      if (key !== "paymentAmount") newRow[key] = val;
                      else newRow.tempPaymentAmount = val;
                    } else if (!["contractNo", "phaseName"].includes(key)) {
                      newRow[key] = row[key];
                    }
                  }
                }

                // Lưu biến tạm cho thanh toán
                newRow.tempCpcNoForSync = row.cpcNo ? String(row.cpcNo).trim() : "";
                if (row.paymentDate) {
                  newRow.tempPaymentDate = appUtils.format.date(new Date(row.paymentDate));
                }

                // --- THIẾT LẬP CỜ THỦ CÔNG (Để engine không tính đè dữ liệu Excel) ---
                newRow.isContractVatManual = !!row.contractVat; // Nếu Excel có tiền VAT thì ưu tiên tiền VAT
                newRow.isVatManual = !!row.cpcVat;
                newRow.isPoWManual = true;
                newRow.isAdvanceManual = true;
                newRow.isRepaymentManual = true;

                if (hasStructuralData) finalRowsToSave.push(newRow);
                else if (newRow.tempCpcNoForSync) syncOnlyRows.push(newRow);
              });

              // CHÈN 3 DÒNG TRỐNG VÀO CUỐI MỖI PHASE
              for (let i = 0; i < 3; i++) {
                const empty = this.createEmptyDetailRow(contract.id, 0);
                empty.phaseId = phaseId;
                finalRowsToSave.push(empty);
              }
            }

            // --- 3. LƯU VÀO DATABASE ---
            if (isOverwrite) {
              await deleteDetailRowsByContract(databaseService, contract.id);
            }

            const maxSort = isOverwrite ? -1 : (this.cpcDetailRows
              .filter(r => r.contractId === contract.id)
              .reduce((max, r) => Math.max(max, r.sortOrder || 0), -1));

            finalRowsToSave.forEach((r, i) => r.sortOrder = maxSort + 1 + i);

            // Chạy engine tính toán lũy kế và tổng cộng
            const calculatedRows = this.runCalculationEngine(finalRowsToSave, contract);
            await addDetailRows(databaseService, calculatedRows);

            // --- 4. ĐỒNG BỘ 2 CHIỀU ---
            const allRowsForSync = [...calculatedRows, ...syncOnlyRows];
            await this._internalBulkSyncFromData(contract, allRowsForSync);
            await this.syncPaymentsToDetails(contract.id);
          }

          const freshData = await databaseService.getAllData();
          this._loadState(freshData);
          this.showToast("Đã cập nhật toàn bộ dữ liệu Hợp đồng, VAT và dòng trống!", "success");

        } catch (err) {
          console.error(err);
          this.showToast("Lỗi đồng bộ dữ liệu.", "error");
        }
      },

      async _internalBulkSyncFromData(contract, allRows) {
        const isUsd = contract.currency === "USD";
        const groupedByCpc = allRows.reduce((acc, row) => {
          if (!row.tempCpcNoForSync) return acc;
          const cpcKey = row.tempCpcNoForSync;
          if (!acc[cpcKey]) acc[cpcKey] = { rows: [], payments: [] };
          acc[cpcKey].rows.push(row);

          // Nếu có dữ liệu thanh toán
          if (row.tempPaymentDate && row.tempPaymentAmount) {
            acc[cpcKey].payments.push({
              date: row.tempPaymentDate,
              amount: row.tempPaymentAmount,
              paymentSource: "Excel Upload"
            });
          }
          return acc;
        }, {});

        for (const cpcNo in groupedByCpc) {
          const data = groupedByCpc[cpcNo];
          const aggregated = this._aggregateCpcDataFromDetailRows(data.rows, isUsd);

          let existingCpc = this.cpcItems.find(c => c.contractId === contract.id && c.cpcIdentifier === cpcNo);
          let targetCpcId;

          const cpcFields = {
            contractId: contract.id, cpcIdentifier: cpcNo,
            projectId: contract.projectId, vendorId: contract.vendorId,
            contents: aggregated.finalContents || ("Thanh toán " + cpcNo),
            amount: isUsd ? 0 : aggregated.finalAmount,
            amountUsd: isUsd ? aggregated.amountDue : 0,
            paymentDueDate: aggregated.paymentDueDate,
            isUsd
          };

          if (existingCpc) {
            targetCpcId = existingCpc.id;
            await updateCpcItemFields(databaseService, targetCpcId, cpcFields);
          } else {
            const createdCpc = await addCpcItem(databaseService, cpcFields);
            targetCpcId = createdCpc.id;
            this.cpcItems.push(createdCpc); // Cập nhật mảng local để tránh duplicate trong cùng 1 lần loop
          }

          // Xử lý Installments (Các đợt thanh toán)
          if (data.payments.length > 0) {
            const rate = isUsd ? 25000 : 0;
            const installmentsToSave = data.payments.map(p => ({
              ...p,
              cpcId: targetCpcId,
              contractId: contract.id,
              projectId: contract.projectId,
              vendorId: contract.vendorId,
              isUsd,
              amountUsd: isUsd ? p.amount : 0,
              exchangeRate: rate,
              amountVND: isUsd ? Math.round(p.amount * rate) : p.amount,
              amount: isUsd ? Math.round(p.amount * rate) : p.amount
            }));
            await replaceInstallmentsForCpc(
              databaseService,
              targetCpcId,
              installmentsToSave
            );
          }
        }
      },

      createEmptyDetailRow(contractId = "", sortOrder = 0) {
        let currentPhaseId = null;
        if (this.viewStates.cpcDetails.activePhaseId !== "summary") {
          currentPhaseId = this.viewStates.cpcDetails.activePhaseId;
        }

        return {
          contractId: contractId,
          phaseId: currentPhaseId,
          sortOrder: sortOrder,
          contractInfo: "",
          description: "",
          contractAmount: 0,
          contractVon: 0,
          contractPercentVat: 0,
          contractVat: 0,
          contractTotal: 0,
          cpcNo: "",
          cpcDueDate: "",
          cpcWorkDone: 0,
          cpcPercentPoW: 0,
          cpcPaymentOfWorkdone: 0,
          cpcPercentAdv: 0,
          cpcAdvance: 0,
          cpcRepayment: 0,
          cpcRetention: 0,
          cpcOtherDeduction: 0,
          cpcAmountDue: 0,
          cpcPercentVat: null,
          cpcVat: 0,

          latestPaymentDate: "",
          paymentTotalAmount: 0,
          paymentTotalVat: 0,
          paymentGrandTotal: 0,
          paymentTotalAmountUsd: 0,
          paymentInstallments: [],

          invoiceNo: "",
          invoiceDate: "",
          invoicePostingDate: "",
          invoiceAmount: 0,
          invoiceVat: 0,
          invoiceTotal: 0,
          invoiceExchangeRate: 0,
          invoiceAmountVND: 0,
          remainingPayable: 0,
          contractRemainingInclVat: 0,
          contractRemainingExclVat: 0,
          contractRemainingVat: 0,
          isExpanded: false,
          linkedCpcId: null,

          isPoWManual: false,
          isAdvanceManual: false,
          isRepaymentManual: false,
          isContractVatManual: false,
          isVatRateManual: false,
          useWorkdoneForRepayment: false,
          repaymentBasisItems: null,
          isFinalSettlement: false,
          isVatManual: false,
        };
      },

      async syncPaymentsToDetails(
        contractId,
        cpcId = null,
        targetTable = null
      ) {
        if (!contractId) return;

        let detailsTable = targetTable
          ? targetTable
          : this.cpcDetailRows.filter((r) => r.contractId === contractId);
        const contract = this.contractMap.get(contractId);

        if (!contract || !detailsTable || detailsTable.length === 0) {
          return;
        }

        detailsTable = JSON.parse(JSON.stringify(detailsTable));

        const isUsdContract = contract.currency === "USD";

        let cpcItemsFromTracking;
        if (cpcId) {
          const cpcItemsForContract =
            this.cpcItemsByContractId.get(contractId) || [];
          cpcItemsFromTracking = cpcItemsForContract.filter(
            (c) => c.id === cpcId
          );
          if (cpcItemsFromTracking.length === 0) return;

          const targetCpcIdentifier = cpcItemsFromTracking[0].cpcIdentifier;
          detailsTable.forEach((row) => {
            if (row.cpcNo === targetCpcIdentifier) {
              row.paymentInstallments = [];
              row.latestPaymentDate = "";
              row.paymentTotalAmount = 0;
              row.paymentTotalVat = 0;
              row.paymentGrandTotal = 0;
              row.paymentTotalAmountUsd = 0;
            }
          });
        } else {
          cpcItemsFromTracking =
            this.cpcItemsByContractId.get(contractId) || [];
          detailsTable.forEach((row) => {
            row.paymentInstallments = [];
            row.latestPaymentDate = "";
            row.paymentTotalAmount = 0;
            row.paymentTotalVat = 0;
            row.paymentGrandTotal = 0;
            row.paymentTotalAmountUsd = 0;
          });
        }

        const detailsByCpcNo = new Map();
        detailsTable.forEach((row) => {
          if (row.cpcNo) {
            if (!detailsByCpcNo.has(row.cpcNo))
              detailsByCpcNo.set(row.cpcNo, []);
            detailsByCpcNo.get(row.cpcNo).push(row);
          }
        });

        for (const cpcItem of cpcItemsFromTracking) {
          const itemInstallments = this.installmentsByCpcId.get(cpcItem.id);
          if (!itemInstallments || itemInstallments.length === 0) continue;

          const detailRowsForCpc = detailsByCpcNo.get(
            cpcItem.cpcIdentifier
          );
          if (!detailRowsForCpc || detailRowsForCpc.length === 0) continue;

          const totalDueForCpc = detailRowsForCpc.reduce((sum, row) => {
            const rowDue = isUsdContract
              ? row.cpcAmountDue || 0
              : (row.cpcAmountDue || 0) + (row.cpcVat || 0);
            return sum + rowDue;
          }, 0);

          if (totalDueForCpc === 0) continue;

          for (const payment of itemInstallments) {
            let paymentAmount = isUsdContract
              ? payment.amountUsd || 0
              : payment.amount || 0;
            let paymentAmountVND = payment.amountVND || payment.amount || 0;
            if (cpcItem.amount < 0) {
              paymentAmount = -Math.abs(paymentAmount);
              paymentAmountVND = -Math.abs(paymentAmountVND);
            }
            for (const detailRow of detailRowsForCpc) {
              const rowDue = isUsdContract
                ? detailRow.cpcAmountDue || 0
                : (detailRow.cpcAmountDue || 0) + (detailRow.cpcVat || 0);
              const allocationRatio = rowDue / totalDueForCpc;
              const allocatedAmount = paymentAmount * allocationRatio;
              const allocatedVND = paymentAmountVND * allocationRatio;
              let allocatedNet = 0,
                allocatedVat = 0,
                allocatedUsd = 0;

              if (isUsdContract) {
                allocatedNet = allocatedAmount;
                allocatedUsd = allocatedAmount;
              } else {
                const cpcRowTotalDue =
                  (detailRow.cpcAmountDue || 0) + (detailRow.cpcVat || 0);
                if (cpcRowTotalDue !== 0) {
                  allocatedNet =
                    allocatedVND *
                    ((detailRow.cpcAmountDue || 0) / cpcRowTotalDue);
                  allocatedVat = allocatedVND - allocatedNet;
                } else {
                  allocatedNet = allocatedVND;
                }
              }
              detailRow.paymentInstallments.push({
                date: payment.date,
                amount: allocatedNet,
                vat: allocatedVat,
                totalVND: allocatedVND,
                amountUsd: allocatedUsd,
                isSwap: payment.isSwap,
              });
            }
          }
        }

        detailsTable.forEach((row) => {
          if (row.paymentInstallments.length > 0) {
            if (isUsdContract) {
              const totalUsd = row.paymentInstallments.reduce(
                (sum, p) => sum + p.amountUsd,
                0
              );
              row.paymentTotalAmount = totalUsd;
              row.paymentTotalAmountUsd = totalUsd;
              row.paymentGrandTotal = totalUsd;
            } else {
              row.paymentTotalAmount = row.paymentInstallments.reduce(
                (sum, p) => sum + p.amount,
                0
              );
              row.paymentTotalVat = row.paymentInstallments.reduce(
                (sum, p) => sum + p.vat,
                0
              );
              row.paymentGrandTotal =
                row.paymentTotalAmount + row.paymentTotalVat;
            }
            row.latestPaymentDate = row.paymentInstallments.reduce(
              (latest, p) => (p.date > latest ? p.date : latest),
              row.paymentInstallments[0].date
            );
          }
        });

        if (!targetTable) {
          const recalculatedTable = this.runCalculationEngine(
            detailsTable,
            contract
          );

          recalculatedTable.forEach((recalculatedRow) => {
            const originalRow = this.cpcDetailRows.find(
              (r) => r.id === recalculatedRow.id
            );
            if (originalRow) {
              Object.assign(originalRow, recalculatedRow);
            }
          });
        }
      },
      async addNewDetailRow(index) {
        this.addNewDetailRowAtIndex(index);
      },
      async addNewDetailRowAtIndex(index) {
        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        if (!contractId) return;

        try {
          const currentDisplayedTable = this.displayedContractDetailTable;

          const currentRow = currentDisplayedTable[index];

          const newRow = this.createEmptyDetailRow(contractId, 0);

          let allRowsOfContract = this.cpcDetailRows
            .filter((r) => r.contractId === contractId)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

          const insertionIndexInGlobal = allRowsOfContract.findIndex(
            (r) => r.id === currentRow.id
          );

          if (insertionIndexInGlobal !== -1) {
            allRowsOfContract.splice(insertionIndexInGlobal + 1, 0, newRow);
          } else {
            allRowsOfContract.push(newRow);
          }

          allRowsOfContract.forEach((row, idx) => {
            row.sortOrder = idx;
          });

          const { reorderedRows } = await addDetailRowAndReorder(
            databaseService,
            newRow,
            allRowsOfContract
          );
          allRowsOfContract = reorderedRows;

          this.cpcDetailRows = this.cpcDetailRows
            .filter((r) => r.contractId !== contractId)
            .concat(allRowsOfContract);

          this.showToast(this.t("rowAddedSuccess"), "success");
        } catch (error) {
          console.error("Lỗi khi thêm dòng mới:", error);
          this.showToast(this.t("rowAddError"), "error");
        }
      },
      deleteDetailRow(itemId) {
        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeletion"),
          message: this.t("confirmDeleteRow"),
          onConfirm: async () => {
            const itemIndex = this.cpcDetailRows.findIndex(
              (item) => item.id === itemId
            );
            if (itemIndex > -1) {
              try {
                await deleteDetailRowById(databaseService, itemId);
                this.cpcDetailRows.splice(itemIndex, 1);
                this.showToast(this.t("rowDeleted"), "success");
              } catch (error) {
                console.error("Error deleting detail row:", error);
                this.showToast("Failed to delete row.", "error");
              }
            }
          },
        });
      },
      clearContractDetails() {
        if (!this.currentDetailItem) return;
        const fields = [
          "contractInfo",
          "description",
          "contractAmount",
          "contractVon",
          "contractPercentVat",
        ];
        fields.forEach((field) => {
          this.currentDetailItem[field] =
            typeof this.currentDetailItem[field] === "number" ? 0 : "";
        });
        this.updateFormulasInModal("contractVat", false);
      },
      clearCpcDetails() {
        if (!this.currentDetailItem) return;

        const fields = [
          "cpcNo",
          "cpcDueDate",
          "cpcWorkDone",
          "cpcPaymentOfWorkdone",
          "cpcPercentAdv",
          "cpcAdvance",
          "cpcRepayment",
          "cpcRetention",
          "cpcOtherDeduction",
          "cpcAmountDue",
          "cpcPercentVat",
          "cpcVat",
        ];
        fields.forEach((field) => {
          this.currentDetailItem[field] =
            typeof this.currentDetailItem[field] === "number" ? 0 : "";
        });

        this.currentDetailItem.isRepaymentManual = false;
        this.currentDetailItem.isPoWManual = false;
        this.currentDetailItem.isAdvanceManual = false;
        this.currentDetailItem.isVatManual = false;
        this.currentDetailItem.isFinalSettlement = false;

        const tableData = this.cpcDetailRows.filter(
          (r) =>
            r.contractId ===
            this.viewStates.cpcDetails.filter.selectedContractId
        );
        this.runCalculationEngine(
          tableData,
          this.selectedContractDetails,
          this.currentDetailIndex
        );
      },
      clearInvoiceDetails() {
        if (!this.currentDetailItem) return;
        const fields = [
          "invoiceNo",
          "invoiceDate",
          "invoicePostingDate",
          "invoiceAmount",
          "invoiceVat",
          "invoiceTotal",
          "invoiceExchangeRate",
          "invoiceAmountVND",
        ];
        fields.forEach((field) => {
          this.currentDetailItem[field] =
            typeof this.currentDetailItem[field] === "number" ? 0 : "";
        });
        this.updateFormulasInModal("invoiceTotal");
      },
      openContractDetailsModal(item, index) {
        this.isContractVatOverrideVisible = false;
        this._setupDetailItemForEdit(item, index);
        if (!this.currentDetailItem.contractPercentVat) {
          const contractSettings = this.selectedContractDetails?.settings;
          if (contractSettings && contractSettings.defaultVatRate) {
            this.currentDetailItem.contractPercentVat =
              contractSettings.defaultVatRate;
            this.updateFormulasInModal("contractPercentVat");
          }
        }
        appUtils.ui.toggleModal("contractDetailsModal", "show");
      },
      async saveContractDetails(shouldCloseModal = true) {
        if (!this.currentDetailItem) return;

        try {
          await saveDetailRow(databaseService, this.currentDetailItem);
          const index = this.cpcDetailRows.findIndex(
            (r) => r.id === this.currentDetailItem.id
          );
          if (index > -1) {
            this.cpcDetailRows[index] = this.currentDetailItem;
          }
          const contractId =
            this.viewStates.cpcDetails.filter.selectedContractId;
          const tableData = this.cpcDetailRows.filter(
            (r) => r.contractId === contractId
          );
          const recalculatedTable = this.runCalculationEngine(
            tableData,
            this.selectedContractDetails
          );
          this.cpcDetailRows = this.cpcDetailRows
            .filter((r) => r.contractId !== contractId)
            .concat(recalculatedTable);

          if (shouldCloseModal) {
            this.showToast("Changes saved successfully.", "success");
            appUtils.ui.toggleModal("contractDetailsModal", "hide");
          }
          return true;
        } catch (error) {
          console.error("Error saving contract details:", error);
          this.showToast("Failed to save changes.", "error");
          if (shouldCloseModal) {
            appUtils.ui.toggleModal("contractDetailsModal", "hide");
          }
          return false;
        }
      },
      openCpcDetailsModal(item, index) {
        this.isVatOverrideVisible = false;

        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        const currentTableState = this.cpcDetailRows
          .filter((r) => r.contractId === contractId)
          .map((r) => JSON.parse(JSON.stringify(r)))
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        this._setupDetailItemForEdit(item, index);

        if (
          !this.currentDetailItem.repaymentBasisItems ||
          this.currentDetailItem.repaymentBasisItems.length === 0
        ) {
          this.currentDetailItem.repaymentBasisItems = currentTableState
            .slice(0, index + 1)
            .filter(
              (r) =>
                (r.contractAmount || 0) !== 0 || (r.contractVon || 0) !== 0
            )
            .map((r) => r.id);
        }

        if (!this.currentDetailItem.isVatRateManual) {
          const contract = this.selectedContractDetails;
          const settings = contract?.settings || {};
          this.currentDetailItem.cpcPercentVat =
            settings.defaultVatRate ?? 8;
        }

        this.updateFormulasInModal("cpcVat");

        appUtils.ui.toggleModal("cpcDetailsModal", "show");
      },
      async saveCpcDetails() {
        if (!this.currentDetailItem) return;
        try {
          delete this.currentDetailItem._isBeingEdited;
          const contractId =
            this.viewStates.cpcDetails.filter.selectedContractId;

          const tempTableData = this.cpcDetailRows
            .filter((r) => r.contractId === contractId)
            .map((r) => JSON.parse(JSON.stringify(r)))
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

          const rowIndex = tempTableData.findIndex(
            (r) => r.id === this.currentDetailItem.id
          );
          if (rowIndex > -1) {
            Object.assign(tempTableData[rowIndex], this.currentDetailItem);
          }

          const recalculatedTable = this.runCalculationEngine(
            tempTableData,
            this.selectedContractDetails,
            0
          );

          recalculatedTable.forEach((row) => {
            if (row.cpcRepayment !== 0 && !row.isRepaymentManual) {
              row.isRepaymentManual = true;
            }
            if (row.cpcPaymentOfWorkdone !== 0 && !row.isPoWManual)
              row.isPoWManual = true;
            if (row.cpcAdvance !== 0 && !row.isAdvanceManual)
              row.isAdvanceManual = true;
            if (row.cpcVat !== 0 && !row.isVatManual)
              row.isVatManual = true;
            if (row.contractVat !== 0 && !row.isContractVatManual)
              row.isContractVatManual = true;
          });

          await saveDetailRows(databaseService, recalculatedTable);

          const otherContractsRows = this.cpcDetailRows.filter(
            (r) => r.contractId !== contractId
          );
          this.cpcDetailRows = otherContractsRows.concat(recalculatedTable);

          this.syncPaymentsToDetails(contractId);

          this.showToast(this.t("changesSavedSuccess"), "success");
        } catch (error) {
          console.error("Error saving CPC details:", error);
          this.showToast("Failed to save changes.", "error");
        }
        appUtils.ui.toggleModal("cpcDetailsModal", "hide");
      },
      openPaymentDetailsModal(item, index) {
        this._setupDetailItemForEdit(item, index);
        appUtils.ui.toggleModal("paymentDetailsModal", "show");
      },
      async savePaymentDetails() {
        if (!this.currentDetailItem) return;
        try {
          await saveDetailRow(databaseService, this.currentDetailItem);
          const index = this.cpcDetailRows.findIndex(
            (r) => r.id === this.currentDetailItem.id
          );
          if (index > -1)
            this.cpcDetailRows[index] = this.currentDetailItem;
          this.showToast("Changes saved successfully.", "success");
        } catch (error) {
          console.error("Error saving payment details:", error);
          this.showToast("Failed to save changes.", "error");
        }
        appUtils.ui.toggleModal("paymentDetailsModal", "hide");
      },
      openInvoiceDetailsModal(item, index) {
        this._setupDetailItemForEdit(item, index);
        this.invoiceSelectedRowIds = this.invoiceCpcRows.map((r) => r.id);
        appUtils.ui.toggleModal("invoiceDetailsModal", "show");
      },
      async saveInvoiceDetails() {
        if (!this.currentDetailItem) return;

        if (
          !this.validateDates(this.currentDetailItem, [
            "invoiceDate",
            "invoicePostingDate",
          ])
        ) {
          return;
        }

        const hasInvoiceData =
          this.currentDetailItem.invoiceNo ||
          (this.currentDetailItem.invoiceAmount || 0) !== 0 ||
          (this.currentDetailItem.invoiceVat || 0) !== 0;

        if (hasInvoiceData && !this.currentDetailItem.invoicePostingDate) {
          this.showToast(this.t("errorPostingDateRequired"), "error");
          return;
        }

        try {
          const contractId =
            this.viewStates.cpcDetails.filter.selectedContractId;
          const currentCpcNo = this.currentDetailItem.cpcNo;

          const rowsToUpdate = this.cpcDetailRows.filter(
            (row) =>
              row.contractId === contractId &&
              this.invoiceSelectedRowIds.includes(row.id)
          );

          if (rowsToUpdate.length === 0) {
            this.showToast(this.t("errorNoRowsToUpdateInvoice"), "warning");
            appUtils.ui.toggleModal("invoiceDetailsModal", "hide");
            return;
          }

          rowsToUpdate.forEach((row) => {
            row.invoicePostingDate =
              this.currentDetailItem.invoicePostingDate;
            if (this.isCurrentContractUSD) {
              row.invoiceExchangeRate =
                this.currentDetailItem.invoiceExchangeRate;
            }
            if (row.id === this.currentDetailItem.id) {
              row.invoiceNo = this.currentDetailItem.invoiceNo;
              row.invoiceDate = this.currentDetailItem.invoiceDate;
              row.invoiceAmount = this.currentDetailItem.invoiceAmount;
              row.invoiceVat = this.currentDetailItem.invoiceVat;
            }
          });

          await saveDetailRows(databaseService, rowsToUpdate);

          const tableDataForContract = this.cpcDetailRows
            .filter((r) => r.contractId === contractId)
            .map((r) => JSON.parse(JSON.stringify(r)));

          const recalculatedTable = this.runCalculationEngine(
            tableDataForContract,
            this.selectedContractDetails
          );

          recalculatedTable.forEach((recalculatedRow) => {
            const originalRow = this.cpcDetailRows.find(
              (r) => r.id === recalculatedRow.id
            );
            if (originalRow) {
              Object.assign(originalRow, recalculatedRow);
            }
          });

          this.showToast(this.t("changesSavedSuccess"), "success");
        } catch (error) {
          console.error("Error saving invoice details:", error);
          this.showToast("Failed to save changes.", "error");
        }

        appUtils.ui.toggleModal("invoiceDetailsModal", "hide");
      },
      formatManualCpcDetailInput(event, field) {
        this.formatNumericInput(event, field, true);
      },
      formatNumericInput(event, field, isManual = false) {
        let value = event.target.value.replace(/\./g, "").replace(/,/g, "");
        if (!isNaN(value) && value.trim() !== "") {
          const numericValue = parseFloat(value);
          this.currentDetailItem[field] = numericValue;
          event.target.value = new Intl.NumberFormat("vi-VN").format(
            numericValue
          );
        } else {
          this.currentDetailItem[field] = 0;
          event.target.value = "0";
        }
        this.updateFormulasInModal(field, isManual);
      },

      calculateFinalSettlement() {
        if (this.isModalInitializing) return;

        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        const tableData = this.cpcDetailRows.filter(
          (r) => r.contractId === contractId
        );
        const currentIndex = this.currentDetailIndex;
        if (!tableData || currentIndex < 0) return;

        const settings = this.selectedContractDetails?.settings || {};
        const retentionRate = (settings.retentionRate || 5) / 100;

        if (!this.currentDetailItem.isFinalSettlement) {
          this.currentDetailItem.cpcWorkDone = 0;
          this.currentDetailItem.cpcPaymentOfWorkdone = 0;
          this.currentDetailItem.cpcRetention = 0;
          this.currentDetailItem.isPoWManual = false;
        } else {
          const totalContractValue = tableData.reduce(
            (sum, row) =>
              sum + (row.contractAmount || 0) + (row.contractVon || 0),
            0
          );
          const cumulativeWorkDone = tableData
            .slice(0, currentIndex)
            .reduce((sum, row) => sum + (row.cpcWorkDone || 0), 0);
          const cumulativePoW = tableData
            .slice(0, currentIndex)
            .reduce((sum, row) => sum + (row.cpcPaymentOfWorkdone || 0), 0);

          this.currentDetailItem.cpcWorkDone =
            totalContractValue - cumulativeWorkDone;
          this.currentDetailItem.cpcPaymentOfWorkdone =
            totalContractValue - cumulativePoW;
          this.currentDetailItem.cpcRetention = -Math.round(
            retentionRate * totalContractValue
          );
          this.currentDetailItem.isPoWManual = true;
        }

        this.updateFormulasInModal("isFinalSettlement");
      },
      triggerInvoiceXmlUpload() {
        this.$refs.invoiceXmlInput.click();
      },
      async handleInvoiceXmlUpload(event) {
        const file = event.target.files[0];
        if (!file || !this.currentDetailItem) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const xmlString = e.target.result;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");

            const getValue = (tagName) =>
              xmlDoc.getElementsByTagName(tagName)[0]?.textContent || "";

            const khmshdon = getValue("KHMSHDon");
            const khhdon = getValue("KHHDon");
            const shdon = getValue("SHDon");

            const invoiceNo = `${khmshdon}${khhdon}#${shdon}`;
            const invoiceDate = getValue("NLap");

            const invoiceAmountTotal = Math.round(
              parseFloat(getValue("TgTCThue"))
            );
            const invoiceVatTotal = Math.round(
              parseFloat(getValue("TgTThue"))
            );

            const contractId =
              this.viewStates.cpcDetails.filter.selectedContractId;
            const currentCpcNo = this.currentDetailItem.cpcNo;

            if (!currentCpcNo) {
              this.showToast(
                "Enter CPC number in the current row before uploading invoice.",
                "warning"
              );
              return;
            }

            const relevantRows = this.cpcDetailRows.filter((row) =>
              this.invoiceSelectedRowIds.includes(row.id)
            );

            if (relevantRows.length === 0) {
              this.showToast(
                `Vui lòng chọn ít nhất một dòng để phân bổ hóa đơn.`,
                "error"
              );
              return;
            }

            const totalWorkDoneForCpc = relevantRows.reduce(
              (sum, row) => sum + (row.cpcWorkDone || 0),
              0
            );
            const totalVatForCpc = relevantRows.reduce(
              (sum, row) => sum + (row.cpcVat || 0),
              0
            );

            let distributedAmount = 0;
            let distributedVat = 0;

            relevantRows.forEach((row, index) => {
              let rowInvoiceAmount = 0;
              let rowInvoiceVat = 0;

              if (index === relevantRows.length - 1) {
                rowInvoiceAmount = invoiceAmountTotal - distributedAmount;
                rowInvoiceVat = invoiceVatTotal - distributedVat;
              } else {
                const workDoneRatio =
                  totalWorkDoneForCpc > 0
                    ? (row.cpcWorkDone || 0) / totalWorkDoneForCpc
                    : 1 / relevantRows.length;
                const vatRatio =
                  totalVatForCpc > 0
                    ? (row.cpcVat || 0) / totalVatForCpc
                    : workDoneRatio;

                rowInvoiceAmount = Math.round(
                  invoiceAmountTotal * workDoneRatio
                );
                rowInvoiceVat = Math.round(invoiceVatTotal * vatRatio);
              }

              row.invoiceNo = invoiceNo;
              row.invoiceDate = invoiceDate;
              row.invoiceAmount = rowInvoiceAmount;
              row.invoiceVat = rowInvoiceVat;

              distributedAmount += rowInvoiceAmount;
              distributedVat += rowInvoiceVat;
            });

            const editedRowInRelevantRows = relevantRows.find(
              (r) => r.id === this.currentDetailItem.id
            );
            if (editedRowInRelevantRows) {
              this.currentDetailItem.invoiceNo =
                editedRowInRelevantRows.invoiceNo;
              this.currentDetailItem.invoiceDate =
                editedRowInRelevantRows.invoiceDate;
              this.currentDetailItem.invoiceAmount =
                editedRowInRelevantRows.invoiceAmount;
              this.currentDetailItem.invoiceVat =
                editedRowInRelevantRows.invoiceVat;
            }

            this.updateFormulasInModal("invoiceAmount");
            this.showToast(this.t("xmlLoadSuccess"), "success");

            this.$nextTick(() => {
              if (this.$refs.invoicePostingDateInput) {
                this.$refs.invoicePostingDateInput.focus();
              }
            });
          } catch (error) {
            console.error("XML Parsing Error:", error);
            this.showToast(this.t("xmlLoadError"), "error");
          }
        };
        reader.readAsText(file);
        event.target.value = "";
      },
      async sendCpcToTracking(detailItem) {
        if (!detailItem.cpcNo) {
          this.showToast(this.t("errorNoDataToSend"), "warning");
          return;
        }
        const contractInfo = this.selectedContractDetails;
        if (!contractInfo) return;

        const allRowsForThisCpc = this.cpcDetailRows.filter(
          (row) =>
            row.contractId === contractInfo.id &&
            row.cpcNo === detailItem.cpcNo
        );

        if (allRowsForThisCpc.length === 0) {
          this.showToast(
            "Không tìm thấy dòng chi tiết nào để gửi.",
            "error"
          );
          return;
        }

        const isUsdContract = contractInfo.currency === "USD";
        const aggregatedData = this._aggregateCpcDataFromDetailRows(
          allRowsForThisCpc,
          isUsdContract
        );

        const existingCpc = this.cpcItems.find(
          (c) =>
            c.contractId === contractInfo.id &&
            c.cpcIdentifier === detailItem.cpcNo
        );

        let confirmationMessage = "";
        let confirmButtonText = "";
        let formattedAmount;

        if (isUsdContract) {
          formattedAmount = this.formatCurrencyUSD(
            aggregatedData.finalAmount
          );
        } else {
          formattedAmount = this.formatCurrency(aggregatedData.finalAmount);
        }

        if (existingCpc) {
          confirmationMessage = this.t("confirmUpdateCpcMessage", {
            cpcNo: detailItem.cpcNo,
            amount: formattedAmount,
          });
          confirmButtonText = this.t("btnUpdate");
        } else {
          confirmationMessage = this.t("confirmSendCpcMessage", {
            cpcNo: detailItem.cpcNo,
            amount: formattedAmount,
          });
          confirmButtonText = this.t("btnSend");
        }

        appUtils.ui.showConfirmation(this, {
          title: `Xác nhận gửi CPC`,
          message: confirmationMessage,
          confirmButtonText: confirmButtonText,
          confirmButtonClass: "btn-primary",
          onConfirm: async () => {
            let targetCpcId;
            let cpcToSave;

            if (existingCpc) {
              cpcToSave = { ...existingCpc };
              if (isUsdContract) {
                cpcToSave.amountUsd = aggregatedData.amountDue;
              } else {
                cpcToSave.amountExclVAT = aggregatedData.amountDue;
                cpcToSave.vatAmount = aggregatedData.vatAmount;
                cpcToSave.amount = aggregatedData.finalAmount;
              }
              if (aggregatedData.finalContents)
                cpcToSave.contents = aggregatedData.finalContents;
              if (aggregatedData.paymentDueDate)
                cpcToSave.paymentDueDate = aggregatedData.paymentDueDate;

              targetCpcId = existingCpc.id;
            } else {
              cpcToSave = {
                contractId: contractInfo.id,
                cpcIdentifier: detailItem.cpcNo,
                contents: aggregatedData.finalContents,
                amount: isUsdContract ? 0 : aggregatedData.finalAmount,
                amountExclVAT: isUsdContract ? 0 : aggregatedData.amountDue,
                vatAmount: aggregatedData.vatAmount,
                amountUsd: isUsdContract ? aggregatedData.amountDue : 0,
                exchangeRate: 0,

                receivedDate: appUtils.format.date(new Date()),

                paymentDueDate: aggregatedData.paymentDueDate,
                lineTracking: "",
                notes: "",
                isExpanded: false,

                projectId: contractInfo.projectId,
                vendorId: contractInfo.vendorId,
                code: contractInfo.code,
                department: contractInfo.department,
                contractSystemNo: contractInfo.contractSystemNo,
              };
              targetCpcId = cpcToSave.id;
            }

            try {
              if (existingCpc) {
                await putCpcItem(databaseService, cpcToSave);
              } else {
                cpcToSave = await addCpcItem(databaseService, cpcToSave);
                targetCpcId = cpcToSave.id;
              }

              if (existingCpc) {
                const index = this.cpcItems.findIndex(
                  (c) => c.id === targetCpcId
                );
                if (index > -1) this.cpcItems[index] = cpcToSave;
                this.showToast(this.t("cpcUpdatedInTracking"), "success");
              } else {
                this.cpcItems.unshift(cpcToSave);
                this.showToast(this.t("cpcSentToTracking"), "success");
              }

              allRowsForThisCpc.forEach((row) => {
                row.linkedCpcId = targetCpcId;
              });
              await saveDetailRows(databaseService, allRowsForThisCpc);

              allRowsForThisCpc.forEach((updatedRow) => {
                const index = this.cpcDetailRows.findIndex(
                  (r) => r.id === updatedRow.id
                );
                if (index > -1) this.cpcDetailRows[index] = updatedRow;
              });

              this.currentTab = "cpc-tracking";
              this.highlightAndScrollToItem(targetCpcId);
            } catch (error) {
              console.error("Error sending CPC to tracking:", error);
              this.showToast("Failed to send CPC.", "error");
            }
          },
        });
      },
      updateDetailsGridWithPayments(savedCpcItem) {
        if (!savedCpcItem || !savedCpcItem.contractId) {
          return;
        }
        if (
          this.currentTab === "cpc-details" &&
          this.viewStates.cpcDetails.filter.selectedContractId ===
          savedCpcItem.contractId
        ) {
          this.syncPaymentsToDetails(savedCpcItem.contractId);
          this.showToast(this.t("cpcPaymentUpdatedInDetails"), "info");
        }
      },
      printCpcDetails() {
        window.print();
      },
      exportDetailsToExcel() {
        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        if (!contractId) {
          this.showToast(this.t("errorSelectContractToExport"), "warning");
          return;
        }
        const contractNo =
          this.contracts.find((c) => c.id === contractId)?.contractNo ||
          "export";
        const tableData = this.displayedContractDetailTable;

        if (tableData.length === 0) {
          this.showToast(this.t("errorNoDetailDataToExport"), "warning");
          return;
        }

        const headers = [
          "contractInfo",
          "description",
          "contractAmount",
          "contractVon",
          "contractPercentVat",
          "contractVat",
          "cpcNo",
          "cpcDueDate",
          "cpcWorkDone",
          "cpcPercentPoW",
          "cpcPaymentOfWorkdone",
          "cpcPercentAdv",
          "cpcAdvance",
          "cpcRepayment",
          "cpcRetention",
          "cpcOtherDeduction",
          "cpcPercentVat",
          "cpcVat",
          "invoiceNo",
          "invoiceDate",
          "invoicePostingDate",
          "invoiceAmount",
          "invoiceVat",
        ];

        const dataToExport = tableData.map((item) => {
          const row = {};
          headers.forEach((header) => {
            row[header] = item[header] !== undefined ? item[header] : null;
          });
          return row;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport, {
          header: headers,
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Details");

        XLSX.writeFile(
          wb,
          `Details_Export_${contractNo}_${appUtils.format.date(
            new Date()
          )}.xlsx`
        );
        this.showToast(this.t("exportDetailsSuccess"), "success");
      },
      t(key, replacements = {}) {
        let translation = this.translations[this.language][key] || key;
        Object.keys(replacements).forEach((rKey) => {
          translation = translation.replace(
            `{${rKey}}`,
            replacements[rKey]
          );
        });
        return translation;
      },
      toggleLanguage() {
        this.language = this.language === "vi" ? "en" : "vi";
        localStorage.setItem("cpcTrackingLanguage", this.language);
      },
      loadLanguage() {
        const savedLanguage = localStorage.getItem("cpcTrackingLanguage");
        if (savedLanguage && ["en", "vi"].includes(savedLanguage))
          this.language = savedLanguage;
      },
      toggleSidebar() {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
      },
      toggleNotificationExpansion(bondId) {
        const index = this.expandedNotificationIds.indexOf(bondId);
        if (index > -1) this.expandedNotificationIds.splice(index, 1);
        else this.expandedNotificationIds.push(bondId);
      },
      isNotificationExpanded(bondId) {
        return this.expandedNotificationIds.includes(bondId);
      },
      formatDateToYYYYMMDD(date) {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return `${d.getFullYear()}-${(d.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      },
      setDefaultDashboardDates() {
        const today = new Date();
        this.viewStates.paymentDashboard.filter.startDate =
          appUtils.format.date(
            new Date(today.getFullYear(), today.getMonth(), 1)
          );
        this.viewStates.paymentDashboard.filter.endDate =
          appUtils.format.date(
            new Date(today.getFullYear(), today.getMonth() + 1, 0)
          );
      },
      toggleExpand(item) {
        const itemIndex = this.cpcItems.findIndex((i) => i.id === item.id);
        if (itemIndex !== -1)
          this.cpcItems[itemIndex].isExpanded =
            !this.cpcItems[itemIndex].isExpanded;
      },
      getTotalAmountPaid(item) {
        return this.installments
          .filter((i) => i.cpcId === item.id)
          .reduce((sum, installment) => sum + (installment.amount || 0), 0);
      },
      formatCurrency(value) {
        if (!value && value !== 0) return "";
        return new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value || 0);
      },
      formatCurrencyUSD(value) {
        if (!value && value !== 0) return "$0.00";
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(value || 0);
      },
      formatNumber(value) {
        if (value === 0) return "0";
        if (!value) return "";
        return new Intl.NumberFormat("vi-VN").format(value);
      },
      formatReportNumber(value) {
        if (value === 0) return "-";
        if (!value) return "";
        return new Intl.NumberFormat("vi-VN").format(value);
      },
      getStatusInfo(item, installments, totalPaid) {
        const amount = item.isUsd ? item.amountUsd : item.amount;
        const paid = item.isUsd
          ? installments.reduce(
            (sum, inst) => sum + (inst.amountUsd || 0),
            0
          )
          : totalPaid;

        const isComplete =
          (amount >= 0 && paid >= amount) ||
          (amount < 0 && paid >= Math.abs(amount));

        if (amount === 0) {
          const hasSettlementInstallment = installments.some(
            (inst) => inst.date
          );
          if (hasSettlementInstallment) {
            return {
              badgeClass: "badge bg-success",
              iconClass: "fas fa-check-circle",
              statusText: this.t("completeWithOffset"),
              statusKey: "complete",
            };
          }
        }
        const hasInstallments = installments.length > 0;
        const swappedInstallments = installments.filter(
          (inst) => inst.isSwap
        );
        const normalInstallments = installments.filter(
          (inst) => !inst.isSwap
        );
        const allAreSwaps =
          hasInstallments && normalInstallments.length === 0;
        const allSwapsPaid = swappedInstallments.every((inst) =>
          this.isSwapFullyPaid(inst)
        );
        const anySwapPaid = swappedInstallments.some(
          (inst) =>
            (inst.swapPayments || []).reduce(
              (sum, p) => sum + p.amount,
              0
            ) > 0
        );

        let badgeClass = "badge",
          iconClass = "",
          statusText = "",
          statusKey = "";

        if (isComplete && amount != 0) {
          if (swappedInstallments.length > 0) {
            if (allSwapsPaid) {
              statusKey = "completeswappayment";
              statusText = this.t(statusKey);
              badgeClass += " bg-success";
              iconClass = "fas fa-check-double";
            } else {
              statusKey = allAreSwaps ? "completeswap" : "partialswap";
              statusText = this.t(statusKey);
              badgeClass += " bg-info";
              iconClass = "fas fa-exchange-alt";
            }
          } else {
            statusKey = "complete";
            statusText = this.t(statusKey);
            badgeClass += " bg-success";
            iconClass = "fas fa-check-circle";
          }
        } else if (paid > 0) {
          if (swappedInstallments.length > 0) {
            if (anySwapPaid && !allSwapsPaid) {
              statusKey = "partialswappayment";
              statusText = this.t(statusKey);
              badgeClass += " bg-info";
              iconClass = "fas fa-exchange-alt";
            } else {
              statusKey = "partialswap";
              statusText = this.t(statusKey);
              badgeClass += " bg-info";
              iconClass = "fas fa-exchange-alt";
            }
          } else {
            statusKey = "partialpayment";
            statusText = this.t(statusKey);
            badgeClass += " bg-warning";
            iconClass = "fas fa-adjust";
          }
        } else if (item.paymentDueDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDate = new Date(item.paymentDueDate);
          dueDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((dueDate - today) / 864e5);
          statusKey = "pending";
          if (diffDays < 0) {
            badgeClass += " bg-danger";
            iconClass = "fas fa-exclamation-triangle";
            statusText = this.t("status_overdue_days", {
              days: -diffDays,
            });
          } else if (diffDays === 0) {
            badgeClass += " bg-due-today";
            iconClass = "fas fa-clock";
            statusText = this.t("status_due_today");
          } else {
            badgeClass += " bg-primary";
            iconClass = "fas fa-calendar-alt";
            statusText = this.t("status_days_left", {
              days: diffDays,
            });
          }
        } else {
          statusKey = "pending";
          statusText = this.t(statusKey);
          badgeClass += " bg-secondary";
          iconClass = "fas fa-hourglass-half";
        }

        return {
          badgeClass,
          iconClass,
          statusText,
          statusKey,
        };
      },
      addNewCpcItem() {
        this.currentEditItem = {
          cpcIdentifier: "",
          contractId: null,
          contractNo: "",
          projectName: "",
          vendorName: "",
          contents: "",
          amount: 0,
          amountExclVAT: 0,
          vatAmount: 0,
          isUsd: false,
          amountUsd: 0,
          exchangeRate: 0,
          receivedDate: "",
          paymentDueDate: "",
          lineTracking: "",
          notes: "",
          installments: [],
          bonds: [],
        };
        this.modalMode = "add";
        appUtils.ui.toggleModal("cpcDetailModal", "show");
      },
      copyItem(item) {
        this._prepareEditItem(item);

        this.currentEditItem.installments = [];
        this.currentEditItem.totalAmountPaid = 0;
        this.currentEditItem.latestPaymentDate = "N/A";

        delete this.currentEditItem.id;

        this.modalMode = "copy";
        appUtils.ui.toggleModal("cpcDetailModal", "show");
      },
      editItem(item) {
        this._prepareEditItem(item);
        this.modalMode = "edit";
        appUtils.ui.toggleModal("cpcDetailModal", "show");
      },

      formatAmountInput(obj, prop) {
        let rawValue = String(obj[prop] || "").replace(/\./g, "");
        let numericValue = parseInt(rawValue, 10) || 0;
        obj.amount = numericValue;
        obj[prop] = numericValue.toLocaleString("vi-VN");
      },
      calculateCpcTotalAmount() {
        const amountExclVAT = this.currentEditItem.amountExclVAT || 0;
        const vatAmount = this.currentEditItem.vatAmount || 0;
        this.currentEditItem.amount = amountExclVAT + vatAmount;
        this.currentEditItem.displayAmount =
          this.currentEditItem.amount.toLocaleString("vi-VN");
      },
      calculateVndFromUsd() {
        if (!this.currentEditItem || !this.currentEditItem.isUsd) return;
        const amountUsd = this.currentEditItem.amountUsd || 0;
        const exchangeRate = this.currentEditItem.exchangeRate || 0;
        const amountExclVAT = Math.round(amountUsd * exchangeRate);
        this.currentEditItem.amountExclVAT = amountExclVAT;
        this.currentEditItem.displayAmountExclVAT =
          amountExclVAT.toLocaleString("vi-VN");
        this.calculateCpcTotalAmount();
      },
      formatCpcAmountUsd() {
        const numericValue = appUtils.text.parseUsdAmount(
          this.currentEditItem.displayAmountUsd
        );

        this.currentEditItem.amountUsd = numericValue;

        this.calculateVndFromUsd();
      },
      formatExchangeRate() {
        const numericValue = appUtils.text.parseVndAmount(
          this.currentEditItem.displayExchangeRate
        );
        this.currentEditItem.exchangeRate = numericValue;
        this.currentEditItem.displayExchangeRate =
          numericValue.toLocaleString("vi-VN");
        this.calculateVndFromUsd();
      },
      formatCpcAmountExclVAT() {
        if (this.currentEditItem.isUsd) return;
        this.currentEditItem.amountExclVAT = appUtils.text.parseVndAmount(
          this.currentEditItem.displayAmountExclVAT
        );
        this.currentEditItem.displayAmountExclVAT =
          this.currentEditItem.amountExclVAT.toLocaleString("vi-VN");
        this.calculateCpcTotalAmount();
      },
      formatCpcVatAmount() {
        this.currentEditItem.vatAmount = appUtils.text.parseVndAmount(
          this.currentEditItem.displayVatAmount
        );
        this.currentEditItem.displayVatAmount =
          this.currentEditItem.vatAmount.toLocaleString("vi-VN");
        this.calculateCpcTotalAmount();
      },

      formatInstallmentAmount(inst) {
        if (inst.isUsd) return;
        inst.amount = appUtils.text.parseVndAmount(inst.displayAmount);
        inst.displayAmount = inst.amount.toLocaleString("vi-VN");
      },
      calculateInstallmentVndFromUsd(inst) {
        const amountUsd = inst.amountUsd || 0;
        const exchangeRate = inst.exchangeRate || 0;
        const amountVND = Math.round(amountUsd * exchangeRate);
        inst.amount = amountVND;
        inst.amountVND = amountVND;
        inst.displayAmount = inst.amount.toLocaleString("vi-VN");
      },
      formatInstallmentAmountUsd(inst) {
        const numericValue = appUtils.text.parseUsdAmount(
          inst.displayAmountUsd
        );

        inst.amountUsd = numericValue;

        this.calculateInstallmentVndFromUsd(inst);
      },
      formatInstallmentExchangeRate(inst) {
        const numericValue = appUtils.text.parseVndAmount(
          inst.displayExchangeRate
        );
        inst.exchangeRate = numericValue;
        inst.displayExchangeRate = numericValue.toLocaleString("vi-VN");
        this.calculateInstallmentVndFromUsd(inst);
      },

      addInstallment() {
        this.currentEditItem.installments.push({
          amount: 0,
          displayAmount: "0",
          date: "",
          paymentSource: "",
          isDateInvalid: false,
          isSwap: false,
          vendorSWAP: "",
          swapAgreement: "",
          swapInformation: "",
          swapDueDatePayment: "",
          swapPayments: [],
          isSwapPaid: false,
          isUsd: false,
          amountUsd: 0,
          exchangeRate: 0,
          displayAmountUsd: "0",
          displayExchangeRate: "0",
          amountVND: 0,
        });
      },
      removeInstallment(index) {
        this.currentEditItem.installments.splice(index, 1);
      },

      closeModal() {
        appUtils.ui.toggleModal("cpcDetailModal", "hide");
      },
      viewBondDetails(item) {
        const contractBonds = this.bonds.filter(
          (b) => b.contractId === item.contractId
        );
        this.currentViewBondItem = {
          ...JSON.parse(JSON.stringify(item)),
          bonds: contractBonds,
        };
        appUtils.ui.toggleModal("bondDetailViewModal", "show");
      },
      closeBondViewModal() {
        appUtils.ui.toggleModal("bondDetailViewModal", "hide");
      },
      startEditing(item, field) {
        this.editingCell.itemId = item.id;
        this.editingCell.field = field;
        this.inlineEditValue = item[field] || "";
        this.$nextTick(() => {
          if (this.$refs.inlineInput && this.$refs.inlineInput[0]) {
            this.$refs.inlineInput[0].focus();
          } else if (this.$refs.inlineInput) {
            this.$refs.inlineInput.focus();
          }
        });
      },
      async saveInlineEdit() {
        if (!this.editingCell.itemId) return;
        const itemIndex = this.cpcItems.findIndex(
          (d) => d.id === this.editingCell.itemId
        );
        if (itemIndex !== -1) {
          const field = this.editingCell.field;
          const originalValue = this.cpcItems[itemIndex][field] || "";
          if (originalValue !== this.inlineEditValue) {
            const itemToUpdate = JSON.parse(
              JSON.stringify(this.cpcItems[itemIndex])
            );
            itemToUpdate[field] = this.inlineEditValue;
            try {
              await putCpcItem(databaseService, itemToUpdate);
              this.cpcItems[itemIndex] = itemToUpdate;
              this.justEditedCell = {
                itemId: this.editingCell.itemId,
                field: this.editingCell.field,
              };
              setTimeout(() => {
                this.justEditedCell = { itemId: null, field: null };
              }, 2000);
            } catch (error) {
              console.error("Error saving inline edit:", error);
              this.showToast("Failed to save changes.", "error");
            }
          }
        }
        this.cancelInlineEdit();
      },
      cancelInlineEdit() {
        this.editingCell.itemId = null;
        this.editingCell.field = null;
        this.inlineEditValue = "";
      },
      initializeColumnVisibility() {
        const savedCpc = JSON.parse(
          localStorage.getItem("cpcColumnVisibility") || "{}"
        );
        this.availableColumns.forEach((col) => {
          this.columnVisibility[col.key] =
            savedCpc[col.key] !== undefined ? savedCpc[col.key] : true;
        });
        const savedPayment = JSON.parse(
          localStorage.getItem("dashboardPaymentColumnVisibility") || "{}"
        );
        this.dashboardPaymentAvailableColumns.forEach((col) => {
          this.dashboardPaymentColumnVisibility[col.key] =
            savedPayment[col.key] !== undefined
              ? savedPayment[col.key]
              : true;
        });
        const savedSwap = JSON.parse(
          localStorage.getItem("swapDashboardColumnVisibility") || "{}"
        );
        this.swapDashboardAvailableColumns.forEach((col) => {
          this.swapDashboardColumnVisibility[col.key] =
            savedSwap[col.key] !== undefined ? savedSwap[col.key] : true;
        });
        const savedBond = JSON.parse(
          localStorage.getItem("dashboardBondColumnVisibility") || "{}"
        );
        this.dashboardBondAvailableColumns.forEach((col) => {
          this.dashboardBondColumnVisibility[col.key] =
            savedBond[col.key] !== undefined ? savedBond[col.key] : true;
        });
        const savedContract = JSON.parse(
          localStorage.getItem("contractDashboardColumnVisibility") || "{}"
        );
        this.contractDashboardAvailableColumns.forEach((col) => {
          this.contractDashboardColumnVisibility[col.key] =
            savedContract[col.key] !== undefined
              ? savedContract[col.key]
              : true;
        });
        this.dashboardBondColumnVisibility["quickSettle"] =
          savedBond["quickSettle"] !== undefined
            ? savedBond["quickSettle"]
            : true;
      },
      saveColumnVisibilityToLocalStorage(type) {
        const visibilityMap = {
          cpc: this.columnVisibility,
          dashboardPayment: this.dashboardPaymentColumnVisibility,
          swapDashboard: this.swapDashboardColumnVisibility,
          dashboardBond: this.dashboardBondColumnVisibility,
          contractDashboard: this.contractDashboardColumnVisibility,
        };
        localStorage.setItem(
          `${type}ColumnVisibility`,
          JSON.stringify(visibilityMap[type])
        );
      },
      highlightAndScrollToItem(itemId) {
        if (!itemId) return;
        this.$nextTick(() => {
          const itemIndex = this.filteredCpcData.findIndex(
            (p) => p.id === itemId
          );
          this.viewStates.cpcTracking.currentPage =
            itemIndex === -1
              ? 1
              : Math.floor(
                itemIndex / this.viewStates.cpcTracking.perPage
              ) + 1;
          this.$nextTick(() => {
            const rowElement = document.getElementById(`cpc-row-${itemId}`);
            if (rowElement) {
              this.highlightedRowId = itemId;
              rowElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
              setTimeout(() => {
                if (this.highlightedRowId === itemId)
                  this.highlightedRowId = null;
              }, 7000);
            }
          });
        });
      },
      downloadExcelTemplate() {
        const wb = XLSX.utils.book_new();

        const headerStyle = { font: { bold: true } };
        const requiredHeaderStyle = {
          font: { bold: true, color: { rgb: "FF0000" } },
        };
        const numberFormat = "#,##0";
        const dateFormat = "yyyy-mm-dd";

        const createSheet = (headers, requiredHeaders, columnFormats) => {
          const ws = XLSX.utils.json_to_sheet([{}], { header: headers });

          headers.forEach((header, index) => {
            const cellAddress = XLSX.utils.encode_cell({ c: index, r: 0 });
            if (ws[cellAddress]) {
              ws[cellAddress].s = requiredHeaders.includes(header)
                ? requiredHeaderStyle
                : headerStyle;
            }
          });

          const colSettings = headers.map((header) => {
            const format = columnFormats[header];
            if (format) {
              const cellAddress = XLSX.utils.encode_cell({
                c: headers.indexOf(header),
                r: 0,
              });
              if (ws[cellAddress]) {
                ws[cellAddress].z = format;
              }
            }
            return { wch: header.length + 5 };
          });
          ws["!cols"] = colSettings;

          ws["!ref"] = XLSX.utils.encode_range({
            s: { c: 0, r: 0 },
            e: { c: headers.length - 1, r: 0 },
          });

          return ws;
        };

        const cpcHeaders = [
          "contractNo",
          "cpc",
          "contents",
          "amountExclVAT",
          "vatAmount",
          "isUsd",
          "amountUsd",
          "exchangeRate",
          "receivedDate",
          "paymentDueDate",
          "lineTracking",
          "notes",
        ];
        const cpcRequired = ["contractNo", "cpc"];
        const cpcFormats = {
          amountExclVAT: numberFormat,
          vatAmount: numberFormat,
          amountUsd: "#,##0.00",
          exchangeRate: numberFormat,
          receivedDate: dateFormat,
          paymentDueDate: dateFormat,
        };
        const cpcWs = createSheet(cpcHeaders, cpcRequired, cpcFormats);
        XLSX.utils.book_append_sheet(wb, cpcWs, "CPC_Main");

        const instHeaders = [
          "contractNo",
          "cpc",
          "amount",
          "date",
          "paymentSource",
          "isUsd",
          "amountUsd",
          "exchangeRate",
          "isSwap",
          "vendorSWAP",
          "swapAgreement",
          "swapInformation",
          "swapDueDatePayment",
        ];
        const instRequired = ["contractNo", "cpc"];
        const instFormats = {
          amount: numberFormat,
          date: dateFormat,
          amountUsd: "#,##0.00",
          exchangeRate: numberFormat,
          swapDueDatePayment: dateFormat,
        };
        const instWs = createSheet(instHeaders, instRequired, instFormats);
        XLSX.utils.book_append_sheet(wb, instWs, "Installments");

        XLSX.writeFile(wb, "cpc_upload_template_formatted.xlsx");
      },
      exportToExcel() {
        try {
          if (!this.filteredCpcData || this.filteredCpcData.length === 0) {
            this.showToast("Không có dữ liệu để xuất.", "warning");
            return;
          }

          const wb = XLSX.utils.book_new();

          const cpcExportData = this.filteredCpcData.map((item) => ({
            projectName: item.projectName,
            cpcIdentifier: item.cpcIdentifier,
            contractNo: item.contractNo,
            contents: item.contents,
            vendorName: item.vendorName,
            code: item.code,
            department: item.department,
            contractSystemNo: item.contractSystemNo,
            vendorNo: item.vendorNo,
            amountExclVAT: item.amountExclVAT,
            vatAmount: item.vatAmount,
            amount: item.amount,
            isUsd: item.isUsd,
            amountUsd: item.amountUsd,
            exchangeRate: item.exchangeRate,
            receivedDate: item.receivedDate,
            paymentDueDate: item.paymentDueDate,
            lineTracking: item.lineTracking,
            notes: item.notes,
          }));

          const installmentsExportData = [];
          const swapPaymentsExportData = [];

          this.filteredCpcData.forEach((item) => {
            (item.installments || []).forEach((inst) => {
              const { swapPayments, ...instDetails } = inst;
              installmentsExportData.push({
                cpcIdentifier: item.cpcIdentifier,
                contractNo: item.contractNo,
                ...instDetails,
              });

              if (inst.isSwap && inst.swapPayments) {
                inst.swapPayments.forEach((p) => {
                  swapPaymentsExportData.push({
                    cpcIdentifier: item.cpcIdentifier,
                    contractNo: item.contractNo,
                    vendorSWAP: inst.vendorSWAP,
                    swapAgreement: inst.swapAgreement,
                    ...p,
                  });
                });
              }
            });
          });

          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(cpcExportData),
            "CPC_Main"
          );
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(installmentsExportData),
            "Installments"
          );
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(swapPaymentsExportData),
            "SWAP_Payments"
          );

          XLSX.writeFile(
            wb,
            `cpc_data_export_${appUtils.format.date(new Date())}.xlsx`
          );

          this.showToast("Xuất dữ liệu ra Excel thành công!", "success");
        } catch (error) {
          console.error("Lỗi khi xuất Excel:", error);
          this.showToast("Đã xảy ra lỗi khi xuất file Excel.", "error");
        }
      },
      clearAllFilters() {
        const currentTab = this.currentTab;

        if (currentTab === "master-data") {
          let cleared = false;
          if (this.masterData.activeSubTab === "vendors") {
            this.masterData.vendors.searchTerm = "";
            this.masterData.vendors.currentPage = 1;
            cleared = true;
          } else if (this.masterData.activeSubTab === "projects") {
            this.masterData.projects.searchTerm = "";
            this.masterData.projects.currentPage = 1;
            cleared = true;
          }

          if (cleared) {
            this.showToast(this.t("allFiltersCleared"), "info");
          }
          return;
        }

        let targetState = null;

        switch (currentTab) {
          case "cpc-tracking":
            targetState = this.viewStates.cpcTracking;
            break;
          case "cpc-details":
            targetState = this.viewStates.cpcDetails;
            break;
          case "vendor-balance":
            targetState = this.viewStates.vendorBalance;
            break;
          case "cpc-dashboard":
            targetState = this.viewStates.paymentDashboard;
            break;
          case "cpc-swap-dashboard":
            targetState = this.viewStates.swapDashboard;
            break;
          case "cpc-bond-dashboard":
            targetState = this.viewStates.bondDashboard;
            break;
          case "cpc-contract-dashboard":
            targetState = this.viewStates.contractDashboard;
            break;
          case "cogs-dashboard":
            targetState = this.viewStates.cogsDashboard;
            break;
        }

        if (targetState && targetState.filter) {
          const filter = targetState.filter;

          for (const filterKey in filter) {
            const filterValue = filter[filterKey];
            if (Array.isArray(filterValue)) {
              filter[filterKey] = [];
            } else if (typeof filterValue === "string") {
              filter[filterKey] = "";
            } else if (
              filterKey === "expansion" &&
              typeof filterValue === "object" &&
              filterValue !== null
            ) {
              Object.keys(filterValue).forEach((expansionKey) => {
                filterValue[expansionKey] = false;
              });
            } else if (
              typeof filterValue !== "object" ||
              filterValue === null
            ) {
              filter[filterKey] = null;
            }
          }

          if (targetState.hasOwnProperty("searchTerm")) {
            targetState.searchTerm = "";
          }

          if (currentTab === "cpc-dashboard") {
            this.setDefaultDashboardDates();
          }

          this.showToast(this.t("allFiltersCleared"), "info");
        } else {
          console.log(`Tab '${currentTab}' không có bộ lọc để xóa.`);
        }
      },
      toggleFilter(filterArray, itemValue) {
        const index = filterArray.indexOf(itemValue);
        if (index > -1) filterArray.splice(index, 1);
        else filterArray.push(itemValue);
      },
      getBondStatusClassForDashboard(bond) {
        if (bond.isSettled)
          return {
            badgeClass: "badge bg-success",
            message: bond.isRenewed
              ? this.t("renewedStatus")
              : this.t("bondSettled"),
          };
        if (!bond.expiryDate)
          return { badgeClass: "badge bg-secondary", message: "N/A" };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiryDate = new Date(bond.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiryDate - today) / 864e5);
        if (diffDays < 0)
          return {
            badgeClass: "badge bg-danger",
            message: this.t("bond_status_overdue", { days: -diffDays }),
          };
        if (diffDays <= 30)
          return {
            badgeClass: "badge bg-warning text-dark",
            message: this.t("bond_status_expiring", { days: diffDays }),
          };
        return {
          badgeClass: "badge bg-primary",
          message: this.t("bond_status_active"),
        };
      },
      editBond(bond) {
        this.openBondModal("edit", bond);
      },
      deleteBond(bondToDelete) {
        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeletion"),
          message:
            this.t("confirmDeleteBond", {
              bondNumber: bondToDelete.bondNumber,
            }) + `<br><small>${this.t("actionCannotBeUndone")}</small>`,
          onConfirm: async () => {
            try {
              const { deletedBondId, originalBondId, originalBondToUpdate } =
                await deleteBondCascade(databaseService, bondToDelete, this.bonds);

              const bondIndexToDelete = this.bonds.findIndex(
                (b) => b.id === deletedBondId
              );
              if (bondIndexToDelete !== -1) {
                this.bonds.splice(bondIndexToDelete, 1);
              }

              if (originalBondToUpdate) {
                const originalBondIndex = this.bonds.findIndex(
                  (b) => b.id === originalBondId
                );
                if (originalBondIndex !== -1) {
                  this.bonds[originalBondIndex] = originalBondToUpdate;
                }
              }

              this.showToast(this.t("bondDeletedSuccess"), "success");
            } catch (error) {
              console.error("Error deleting bond:", error);
              this.showToast(this.t("errorFindBondToDelete"), "error");
            }
          },
        });
      },
      clearFilteredBonds() {
        const visibleBondIds = this.filteredBondsDashboard.map((b) => b.id);
        if (visibleBondIds.length === 0) return;
        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeletion"),
          message: this.t("confirmClearVisibleBonds", {
            count: visibleBondIds.length,
          }),
          onConfirm: async () => {
            try {
              const { deletedBondIds } = await deleteBondsByIds(
                databaseService,
                visibleBondIds
              );
              this.bonds = this.bonds.filter(
                (bond) => !deletedBondIds.includes(bond.id)
              );
              this.showToast(
                this.t("visibleBondsCleared", {
                  count: deletedBondIds.length,
                }),
                "success"
              );
            } catch (error) {
              console.error("Error clearing filtered bonds:", error);
              this.showToast("Failed to clear bonds.", "error");
            }
          },
        });
      },
      clearFilteredContracts() {
        const visibleContracts = this.filteredContractDashboardData;
        if (visibleContracts.length === 0) return;
        const visibleContractIds = visibleContracts.map((c) => c.id);

        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeletion"),
          message: this.t("confirmClearVisibleContracts", {
            count: visibleContractIds.length,
          }),
          onConfirm: async () => {
            try {
              const { cpcItemIdsToDelete } = await deleteContractsCascade(
                databaseService,
                visibleContractIds
              );

              this.contracts = this.contracts.filter(
                (c) => !visibleContractIds.includes(c.id)
              );
              if (cpcItemIdsToDelete.length > 0) {
                this.cpcItems = this.cpcItems.filter(
                  (cpc) => !visibleContractIds.includes(cpc.contractId)
                );
                this.installments = this.installments.filter(
                  (inst) => !cpcItemIdsToDelete.includes(inst.cpcId)
                );
                this.bonds = this.bonds.filter(
                  (bond) => !cpcItemIdsToDelete.includes(bond.cpcId)
                );
                this.cpcDetailRows = this.cpcDetailRows.filter(
                  (r) => !visibleContractIds.includes(r.contractId)
                );
              }

              this.showToast(
                this.t("visibleContractsCleared", {
                  count: visibleContractIds.length,
                }),
                "success"
              );
            } catch (error) {
              console.error(
                "Error clearing filtered contracts and their related data:",
                error
              );
              this.showToast("Failed to clear contracts.", "error");
            }
          },
        });
      },
      openRenewBondModal(bond) {
        this.currentRenewBond = JSON.parse(JSON.stringify(bond));
        this.newBondDetails = {
              /*id: crypto.randomUUID(),*/ bondNumber: bond.bondNumber,
          ref: bond.ref,
          bondType: bond.bondType,
          amount: bond.amount,
          displayAmount: bond.amount.toLocaleString("vi-VN"),
          issueDate: "",
          expiryDate: "",
          issuingBank: bond.issuingBank,
          isSettled: false,
          settlementReasonDisplay: "",
          renewedFromBondNumber: bond.bondNumber,
          renewalNotes: "",
          renewalDate: appUtils.format.date(new Date()),
        };
        appUtils.ui.toggleModal("renewBondModal", "show");
      },
      formatNewBondAmount() {
        this.newBondDetails.amount = appUtils.text.parseVndAmount(
          this.newBondDetails.displayAmount
        );
        this.newBondDetails.displayAmount =
          this.newBondDetails.amount.toLocaleString("vi-VN");
      },
      async saveRenewedBond() {
        if (
          !this.validateDates(this.newBondDetails, [
            "issueDate",
            "expiryDate",
          ])
        ) {
          return;
        }
        if (
          !this.newBondDetails.expiryDate ||
          !this.newBondDetails.issueDate
        ) {
          this.showToast(this.t("errorNewBondDates"), "error");
          return;
        }

        try {
          const { originalBondIndex, originalBondToUpdate, newBond } =
            await renewBondRecord(
              databaseService,
              this.bonds,
              this.currentRenewBond,
              this.newBondDetails,
              this.t("renewedStatus")
            );

          this.bonds[originalBondIndex] = originalBondToUpdate;
          this.bonds.push(newBond);

          this.showToast(this.t("bondRenewedSuccess"), "success");
          this.closeRenewBondModal();
        } catch (error) {
          if (error?.code === "ORIGINAL_BOND_NOT_FOUND") {
            this.showToast(this.t("errorFindOriginalCpcItem"), "error");
            return;
          }
          console.error("Error renewing bond:", error);
          this.showToast("Failed to renew bond.", "error");
        }
      },

      closeRenewBondModal() {
        appUtils.ui.toggleModal("renewBondModal", "hide");
      },
      async saveBondModal() {
        if (!this.requirePermission("data.write")) return;
        if (!this.currentEditBond) return;

        const isSettled =
          this.currentEditBond.isAdvanceSettled ||
          this.currentEditBond.isContractSettled ||
          this.currentEditBond.isOtherReasonSettled;
        let reasons = [];
        if (this.currentEditBond.isAdvanceSettled)
          reasons.push(this.t("advancePaymentsCleared"));
        if (this.currentEditBond.isContractSettled)
          reasons.push(this.t("contractSettled"));
        if (
          this.currentEditBond.isOtherReasonSettled &&
          this.currentEditBond.otherReasonText
        )
          reasons.push(
            `${this.t("otherReason")}: ${this.currentEditBond.otherReasonText
            }`
          );
        const settlementReasonDisplay = reasons.join(", ");

        const bondIndex = this.bonds.findIndex(
          (b) => b.id === this.currentEditBond.id
        );
        if (bondIndex > -1) {
          const bondToUpdate = this.bonds[bondIndex];
          bondToUpdate.isSettled = isSettled;
          bondToUpdate.settlementReasonDisplay = settlementReasonDisplay;
          try {
            await putBondRecord(databaseService, bondToUpdate);
            this.showToast(this.t("bondInfoSaved"), "success");
          } catch (error) {
            console.error("Error saving bond status:", error);
            this.showToast("Failed to save bond status.", "error");
            this.bonds[bondIndex] = JSON.parse(
              JSON.stringify(this.bonds[bondIndex])
            );
          }
        }
        this.closeBondEditModal();
      },
      closeBondEditModal() {
        appUtils.ui.toggleModal("bondEditModal", "hide");
      },
      showToast(message, type = "info", duration = 4000) {
        const id = Date.now() + Math.random();
        this.toasts.push({ id, message, type });
        this.$nextTick(() => {
          const toastElement = document.querySelector(
            `.toast-notification[data-toast-id="${id}"]`
          );
          if (toastElement) {
            void toastElement.offsetWidth;
            toastElement.classList.add("show");
          }
        });
        setTimeout(() => {
          const toastElement = document.querySelector(
            `.toast-notification[data-toast-id="${id}"]`
          );
          if (toastElement) {
            toastElement.classList.remove("show");
            setTimeout(() => {
              this.toasts = this.toasts.filter((t) => t.id !== id);
            }, 500);
          }
        }, duration);
      },

      confirmAction() {
        if (typeof this.confirmation.onConfirm === "function") {
          this.confirmation.onConfirm();
        }
        appUtils.ui.toggleModal("confirmationModal", "hide");
      },
      neutralAction() {
        if (typeof this.confirmation.onNeutral === "function") {
          this.confirmation.onNeutral();
        }
      },
      closeConfirmationModal() {
        appUtils.ui.toggleModal("confirmationModal", "hide");
      },
      deleteItem(itemToDelete) {
        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeletion"),
          message: this.t("confirmDeleteCpcItem", {
            cpc: itemToDelete.cpcIdentifier,
          }),
          onConfirm: async () => {
            try {
              const { cpcId, installmentIdsToDelete, bondIdsToDelete } =
                await deleteCpcCascade(
                  databaseService,
                  itemToDelete,
                  this.installmentsByCpcId,
                  this.bonds
                );

              const cpcIndex = this.cpcItems.findIndex(
                (item) => item.id === cpcId
              );
              if (cpcIndex > -1) this.cpcItems.splice(cpcIndex, 1);

              if (installmentIdsToDelete.length > 0) {
                const idsSet = new Set(installmentIdsToDelete);
                this.installments = this.installments.filter(
                  (i) => !idsSet.has(i.id)
                );
              }
              if (bondIdsToDelete.length > 0) {
                const idsSet = new Set(bondIdsToDelete);
                this.bonds = this.bonds.filter((b) => !idsSet.has(b.id));
              }

              this.triggerReactivity();
              this.showToast(this.t("itemDeleted"), "success");

              const totalPages = this.totalPages;
              if (
                this.viewStates.cpcTracking.currentPage > totalPages &&
                this.viewStates.cpcTracking.currentPage > 1
              ) {
                this.viewStates.cpcTracking.currentPage = totalPages;
              }
            } catch (error) {
              console.error("Error deleting item:", error);
              this.showToast("Failed to delete item.", "error");
            }
          },
        });
      },
      clearAllData() {
        if (!this.requirePermission("admin.maintenance")) return;
        appUtils.ui.showConfirmation(this, {
          title: this.t("btnClearAll"),
          message: `<strong>${this.t("warning")}!</strong> ${this.t(
            "confirmClearAllData"
          )}`,
          confirmButtonClass: "btn-danger",
          confirmButtonText: this.t("yesClearAll"),
          onConfirm: async () => {
            try {
              await clearAllTables(databaseService);
              this.projects = [];
              this.vendors = [];
              this.banks = [];
              this.contracts = [];
              this.cpcItems = [];
              this.installments = [];
              this.bonds = [];
              this.cpcDetailRows = [];
              this.reportCategoriesFromDB = [];
              this.viewStates.cpcTracking.currentPage = 1;
              this.showToast(this.t("allDataCleared"), "warning");
            } catch (error) {
              console.error("Error clearing all data:", error);
              this.showToast("Failed to clear all data.", "error");
            }
          },
        });
      },
      triggerFileOpen() {
        this.$refs.restoreJsonInput.click();
      },
      async handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDataLoad"),
          message: `<strong>${this.t("warning")}!</strong> ${this.t(
            "confirmOverwriteData"
          )}`,
          confirmButtonClass: "btn-primary",
          onConfirm: () => {
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                const jsonData = JSON.parse(e.target.result);

                const dataToRestore = jsonData.contracts
                  ? jsonData
                  : jsonData;

                if (dataToRestore.contracts && dataToRestore.cpcItems) {
                  this.isDataLoading = true;

                  await databaseService.saveAllData(dataToRestore);

                  this._loadState(dataToRestore);

                  this.triggerReactivity();
                  this.$nextTick(() => {
                    this.initializeFuse();
                    this._recalculateAllDetailRowsAfterLoad();
                    this.isDataLoading = false;
                  });

                  this.showToast(this.t("loadSuccess"), "success");
                } else {
                  this.showToast(this.t("invalidJsonFormat"), "error");
                }
              } catch (error) {
                console.error("Restore Error:", error);
                this.showToast(this.t("errorParsingJson"), "error");
              }
            };
            reader.readAsText(file);
          },
        });
        event.target.value = "";
      },


      openGuideModal() {
        appUtils.ui.toggleModal("guideModal", "show");
      },
      openContractModal() {
        appUtils.ui.toggleModal("contractDetailModal", "show");
      },
      closeContractModal() {
        appUtils.ui.toggleModal("contractDetailModal", "hide");
      },
      addNewContractItem() {
        this.contractModalMode = "add";
        this.currentEditContract = {
          projectName: this.currentEditItem?.projectName || "",
          vendorName: this.currentEditItem?.vendorName || "",
          vendorNo: this.currentEditItem?.vendorNo || "",

          contractNo: "",
          date: new Date().toISOString().slice(0, 10),
          description: this.currentEditItem?.contents || "",
          glAccount: "",
          code: this.currentEditItem?.code || "",
          department: this.currentEditItem?.department || "",
          contractSystemNo: "",
          currency: "VND",
          significantNotes: "",
          status: "Active",
          statusNote: "",
          settings: {
            repaymentThreshold: 80,
            retentionRate: 5,
            defaultVatRate: 8,
          },
        };
        this.openContractModal();
      },
      editContractItem(contract) {
        this.contractModalMode = "edit";
        this.currentEditContract = JSON.parse(JSON.stringify(contract));
        const vendor = this.vendors.find(
          (v) => v.id === this.currentEditContract.vendorId
        );
        if (vendor) {
          this.currentEditContract.vendorAbbrName = vendor.abbrName || "";
        } else {
          this.currentEditContract.vendorAbbrName = "";
        }
        if (!this.currentEditContract.settings) {
          this.currentEditContract.settings = {
            repaymentThreshold: 80,
            retentionRate: 5,
            defaultVatRate: 8,
          };
        }
        this.openContractModal();
      },
      async saveContractModal() {
        if (
          !this.currentEditContract ||
          !this.currentEditContract.contractNo
        ) {
          this.showToast(this.t("errorContractNumberRequired"), "error");
          return;
        }
        const contractValidationErrors = validateContractInput(this.currentEditContract);
        if (contractValidationErrors.length > 0) {
          this.showToast(contractValidationErrors[0], "error");
          return;
        }

        if (!this.validateDates(this.currentEditContract, ["date"])) {
          return;
        }
        try {
          await saveContractFromModal(
            databaseService,
            this.currentEditContract,
            this.contractModalMode
          );

          const freshData = await databaseService.getAllData();
          this._loadState(freshData);
          this.initializeFuse();

          this.showToast(this.t("contractSavedSuccess"), "success");
          this.closeContractModal();
        } catch (error) {
          console.error("Error saving contract:", error);
          if (error.name === "ConstraintError") {
            this.showToast(
              `Lỗi: Số hợp đồng '${this.currentEditContract.contractNo}' đã tồn tại.`,
              "error"
            );
          } else {
            this.showToast("Failed to save contract.", "error");
          }
        }
      },
      deleteContractItem(contractToDelete) {
        appUtils.ui.showConfirmation(this, {
          title: this.t("confirmDeletion"),
          message: this.t("confirmDeleteContract", {
            contractNo: contractToDelete.contractNo,
          }),
          onConfirm: async () => {
            const contractIdToDelete = contractToDelete.id;
            try {
              const { cpcItemIdsToDelete } = await deleteContractCascade(
                databaseService,
                contractIdToDelete
              );

              const contractIndex = this.contracts.findIndex(
                (c) => c.id === contractIdToDelete
              );
              if (contractIndex > -1)
                this.contracts.splice(contractIndex, 1);

              if (cpcItemIdsToDelete.length > 0) {
                const cpcIdsSet = new Set(cpcItemIdsToDelete);
                this.cpcItems = this.cpcItems.filter(
                  (cpc) => cpc.contractId !== contractIdToDelete
                );
                this.installments = this.installments.filter(
                  (inst) => !cpcIdsSet.has(inst.cpcId)
                );
                this.bonds = this.bonds.filter(
                  (bond) => !cpcIdsSet.has(bond.cpcId)
                );
              }
              this.cpcDetailRows = this.cpcDetailRows.filter(
                (r) => r.contractId !== contractIdToDelete
              );

              this.showToast(this.t("contractDeletedSuccess"), "success");
            } catch (error) {
              console.error(
                "Error during cascading delete for contract:",
                error
              );
              this.showToast(
                "Failed to delete contract and its related data.",
                "error"
              );
            }
          },
        });
      },
      downloadContractTemplate() {
        const wb = XLSX.utils.book_new();
        const contractHeaders = [
          "project",
          "glAccount",
          "contractNo",
          "date",
          "vendorNo",
          "description",
          "code",
          "department",
          "contractSystemNo",
          "currency",
          "status",
          "statusNote",
        ];
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet([], { header: contractHeaders }),
          "Contracts"
        );
        XLSX.writeFile(wb, "contracts_template.xlsx");
      },
      exportContractDashboardToExcel() {
        const dataToExport =
          this.formattedPaginatedContractDashboardData.map((item) => {
            const row = {};
            this.visibleContractDashboardColumns.forEach((col) => {
              row[col.label] =
                item[col.key + "Formatted"] || item[col.key] || "";
            });
            return row;
          });
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "ContractDashboard");
        XLSX.writeFile(
          wb,
          `contract_dashboard_export_${appUtils.format.date(
            new Date()
          )}.xlsx`
        );
        this.showToast(this.t("changesSavedSuccess"), "success");
      },
      triggerContractFileUpload() {
        this.$refs.uploadContractExcelInput.click();
      },
      async handleContractFileUpload(event) {
        if (!this.requirePermission("import.execute")) return;
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), {
              type: "array",
            });
            const contractSheet = workbook.Sheets["Contracts"];
            if (!contractSheet) {
              this.showToast(
                this.t("errorSheetNotFound", { sheet: "Contracts" }),
                "error"
              );
              return;
            }
            const newContractsRaw = XLSX.utils.sheet_to_json(
              contractSheet,
              { raw: false, defval: null }
            );

            const {
              addedCount,
              updatedCount,
              skippedCount,
              skippedContractsInfo,
            } = await mergeContractsFromRows(databaseService, newContractsRaw, {
              vendors: this.vendors,
              projects: this.projects,
              contracts: this.contracts,
            });

            await databaseService.saveTables({
              projects: this.projects,
              contracts: this.contracts,
            });
            const freshData = await databaseService.getAllData();
            this._loadState(freshData);

            let messageParts = [];
            if (addedCount > 0)
              messageParts.push(`Đã thêm ${addedCount} hợp đồng mới`);
            if (updatedCount > 0)
              messageParts.push(`Đã cập nhật ${updatedCount} hợp đồng`);
            if (skippedCount > 0)
              messageParts.push(
                `Đã bỏ qua ${skippedCount} hợp đồng do lỗi`
              );

            const finalMessage =
              messageParts.length > 0
                ? messageParts.join(". ") + "."
                : "Không có hợp đồng nào được xử lý.";

            if (skippedContractsInfo.length > 0) {
              console.warn(
                "Các hợp đồng bị bỏ qua khi upload:",
                skippedContractsInfo
              );
            }
            this.initializeFuse();
            this.showToast(
              finalMessage,
              addedCount > 0 || updatedCount > 0 ? "success" : "info"
            );
          } catch (error) {
            console.error("Contract Upload Error:", error);
            this.showToast(this.t("errorProcessingExcel"), "error");
          } finally {
            event.target.value = "";
          }
        };
        reader.readAsArrayBuffer(file);
      },
      async editInstallment(payment) {
        this.currentEditInstallment = JSON.parse(JSON.stringify(payment));
        this.currentEditInstallment.displayAmount = (
          this.currentEditInstallment.amount || 0
        ).toLocaleString("vi-VN");
        appUtils.ui.toggleModal("installmentEditModal", "show");
      },
      closeInstallmentModal() {
        appUtils.ui.toggleModal("installmentEditModal", "hide");
      },
      formatInstallmentEditAmount() {
        const amount = appUtils.text.parseVndAmount(
          this.currentEditInstallment.displayAmount
        );
        this.currentEditInstallment.amount = amount;
        this.currentEditInstallment.displayAmount =
          amount.toLocaleString("vi-VN");
      },
      async saveInstallmentModal() {
        if (!this.currentEditInstallment) return;
        const installmentValidationErrors = validateInstallmentInput(this.currentEditInstallment);
        if (installmentValidationErrors.length > 0) {
          this.showToast(installmentValidationErrors[0], "error");
          return;
        }
        if (!this.validateDates(this.currentEditInstallment, ["date"])) {
          return;
        }
        try {
          const { installmentToUpdate, instIndex } = await updateInstallment(
            databaseService,
            this.installments,
            this.currentEditInstallment
          );
          this.installments[instIndex] = installmentToUpdate;
          this.showToast(this.t("paymentUpdatedSuccess"), "success");
          this.closeInstallmentModal();
        } catch (error) {
          if (error.message === "INSTALLMENT_NOT_FOUND") {
            this.showToast(this.t("errorUpdatingPayment"), "error");
            return;
          }
          console.error("Error updating installment:", error);
          this.showToast(this.t("errorUpdatingPayment"), "error");
        }
      },
      handleScroll() {
        const mainContent = this.$refs.mainContentWrapper;
        if (mainContent) {
          this.showScrollToTopButton = mainContent.scrollTop > 300;
        }
      },
      scrollToTop() {
        this.$refs.mainContentWrapper?.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      },
      isSwapFullyPaid(installment) {
        if (!installment.isSwap) return false;
        const totalPaid = (installment.swapPayments || []).reduce(
          (sum, p) => sum + p.amount,
          0
        );
        return totalPaid >= installment.amount;
      },
      getSwapStatusInfo(swap) {
        const totalPaid = swap.totalSwapPaidAmount || 0;
        const amount = swap.amount || 0;
        const isReceivable = swap.transactionType === "receivable";

        if (totalPaid >= amount && amount > 0) {
          return {
            badgeClass: "badge bg-success",
            iconClass: "fas fa-check-circle",
            statusText: isReceivable
              ? this.t("collected")
              : this.t("paidStatus"),
          };
        }
        if (totalPaid > 0 && totalPaid < amount) {
          return {
            badgeClass: "badge bg-info",
            iconClass: "fas fa-adjust",
            statusText: isReceivable
              ? this.t("partiallyCollected")
              : this.t("partialpayment"),
          };
        }
        return {
          badgeClass: "badge bg-warning",
          iconClass: "fas fa-hourglass-half",
          statusText: isReceivable
            ? this.t("uncollected")
            : this.t("unpaidStatus"),
        };
      },
      addSwapPayment(installment) {
        if (!installment.swapPayments) {
          installment.swapPayments = [];
        }
        installment.swapPayments.push({
          amount: 0,
          displayAmount: "",
          date: "",
          source: "",
        });
      },
      removeSwapPayment(installment, index) {
        installment.swapPayments.splice(index, 1);
      },
      formatSwapPaymentAmount(payment) {
        this.formatAmountInput(payment, "displayAmount");
      },
      totalSwapPayments(installment) {
        const total = (installment.swapPayments || []).reduce(
          (sum, p) => sum + p.amount,
          0
        );
        return appUtils.format.currency(total);
      },
      editSwap(swap) {
        this.currentEditSwap = JSON.parse(JSON.stringify(swap));
        if (this.currentEditSwap.swapPayments) {
          this.currentEditSwap.swapPayments.forEach((p) => {
            p.displayAmount = (p.amount || 0).toLocaleString("vi-VN");
          });
        }
        appUtils.ui.toggleModal("swapEditModal", "show");
      },
      closeSwapModal() {
        appUtils.ui.toggleModal("swapEditModal", "hide");
      },
      async saveSwapModal() {
        if (!this.currentEditSwap) return;
        const dateFields = ["date", "swapDueDatePayment"];
        if (!this.validateDates(this.currentEditSwap, dateFields)) {
          return;
        }
        try {
          const { installmentToUpdate, installmentIndex } =
            await saveSwapInstallment(
              databaseService,
              this.installments,
              this.currentEditSwap,
              this.isSwapFullyPaid
            );

          this.installments[installmentIndex] = installmentToUpdate;

          this.triggerReactivity();

          this.showToast(this.t("changesSavedSuccess"), "success");
          this.closeSwapModal();
        } catch (error) {
          console.error("Error saving swap details:", error);
          this.showToast("Failed to save SWAP details.", "error");
        }
      },
      async syncTrackingToDetails(cpcItem) {
        if (!cpcItem || !cpcItem.contractId || !cpcItem.cpcIdentifier) {
          return;
        }

        const detailsTable = this.cpcDetailRows.filter(
          (r) => r.contractId === cpcItem.contractId
        );
        if (detailsTable.length === 0) {
          return;
        }

        let wasUpdated = false;
        const matchingDetailRows = detailsTable.filter(
          (row) => row.cpcNo === cpcItem.cpcIdentifier
        );

        if (matchingDetailRows.length > 0) {
          matchingDetailRows.forEach((row) => {
            if (row.linkedCpcId !== cpcItem.id) {
              row.linkedCpcId = cpcItem.id;
              wasUpdated = true;
            }
          });
        }
        if (wasUpdated) {
          await saveDetailRows(databaseService, matchingDetailRows);
        }
      },
      toggleSwapExpand(swapItem) {
        toggleSwapExpanded(this.installments, swapItem?.id);
      },
      getDefaultCpcDetailsColumnVisibility() {
        return buildDefaultCpcDetailsColumnVisibility(
          this.detailsAvailableColumnGroups,
          this.detailsAllSubColumns
        );
      },
      loadContractColumnSettings(contractId) {
        const contract = this.contracts.find((c) => c.id === contractId);
        const defaults = this.getDefaultCpcDetailsColumnVisibility();
        const nextState = loadContractColumnSettingsState(contract, defaults);
        this.viewStates.cpcDetails.columnVisibility = nextState.columnVisibility;
        this.viewStates.cpcDetails.subColumnVisibility = nextState.subColumnVisibility;
      },
      async toggleDetailColumnVisibility(type, key) {
        const contractId =
          this.viewStates.cpcDetails.filter.selectedContractId;
        if (!contractId) return;

        const contract = this.contracts.find((c) => c.id === contractId);
        if (!contract) return;

        const updatedContract = toggleContractColumnVisibility(
          contract,
          this.viewStates.cpcDetails,
          type,
          key,
          this.getDefaultCpcDetailsColumnVisibility()
        );

        try {
          await putContractRecord(databaseService, updatedContract);
        } catch (error) {
          console.error("Error saving column visibility:", error);
        }
      },
      getRowIndex(rowId) {
        const contractId = this.viewStates.cpcDetails.filter.selectedContractId;
        return findRowIndexByContract(this.cpcDetailRows, contractId, rowId);
      },
      downloadMasterDataTemplate() {
        const wb = buildMasterVendorTemplate(XLSX);
        XLSX.writeFile(wb, "master_data_template.xlsx");
      },
      triggerMasterDataUpload() {
        this.$refs.uploadMasterDataInput.click();
      },
      async handleMasterDataUpload(event) {
        if (!this.requirePermission("masterdata.manage")) return;
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), {
              type: "array",
            });
            const rows = getVendorRowsFromWorkbook(XLSX, workbook);
            if (!rows) {
              this.showToast("Khong tim thay sheet Vendors hoac du lieu khong hop le.", "error");
              return;
            }
            const { vendorsToAdd, addedCount, skippedCount } =
              buildVendorImportPayload(rows, this.vendors);

            if (vendorsToAdd.length > 0) {
              const { vendors } = await importVendors(
                databaseService,
                vendorsToAdd
              );
              this.vendors = vendors;
              this.initializeFuse();
            }

            let message = `Da them thanh cong ${addedCount} nha cung cap moi.`;
            if (skippedCount > 0) {
              message += ` Bo qua ${skippedCount} dong do trung ma hoac thieu du lieu.`;
            }
            this.showToast(message, addedCount > 0 ? "success" : "info");

          } catch (error) {
            console.error("Master Data Upload Error:", error);
            if (error.name === 'ConstraintError') {
              this.showToast("Loi: Phat hien ma NCC bi trung lap nghiem trong trong file.", "error");
            } else {
              this.showToast(this.t("errorProcessingExcel"), "error");
            }
          } finally {
            event.target.value = "";
          }
        };
        reader.readAsArrayBuffer(file);
      },
      triggerAccountingFileUpload() {
        this.$refs.accountingUploadInput.click();
      },
      clearAccountingComparison() {
        this.accountingComparisonData = null;
        this.$refs.accountingUploadInput.value = "";
        this.showToast(this.t("accountingReconciliationCleared"), "info");
      },
      async handleAccountingFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), {
              type: "array",
            });
            const parsed = parseAccountingWorkbook(XLSX, workbook);
            if (parsed.errorSheet) {
              this.showToast(
                this.t("errorSheetNotFound", { sheetName: parsed.errorSheet }),
                "error"
              );
              return;
            }
            const excelData = parsed.data || {};

            this.accountingComparisonData = excelData;

            await this._recalculateAllDetailRowsAfterLoad();

            this.showToast(
              this.t("accountingUploadSuccess", {
                count: Object.keys(excelData).length,
              }),
              "success"
            );
          } catch (error) {
            console.error("Loi xu ly file ke toan:", error);
            this.showToast(this.t("errorProcessingExcel"), "error");
          }
        };
        reader.readAsArrayBuffer(file);
      },
      getComparisonStatusBadge(status) {
        return getComparisonStatusBadgeClass(status);
      },
    },
  });
  app.directive("focus", {
    mounted(el) {
      el.focus();
      if (el.tagName === "INPUT") el.select();
    },
  });
  app.mount("#app");
  window.vueApp = app;
