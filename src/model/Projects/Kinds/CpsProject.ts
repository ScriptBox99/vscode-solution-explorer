import * as path from "path";
import * as fs from "../../../async/fs";
import * as xml from "../../../async/xml";
import * as SolutionExplorerConfiguration from "../../../SolutionExplorerConfiguration";
import * as Utilities from "../../Utilities";
import { ProjectInSolution } from "../../Solutions";
import { ProjectFile } from "../ProjectFile";
import { ProjectFolder } from "../ProjectFolder";
import { PackageReference } from "../PackageReference";
import { ProjectReference } from "../ProjectReference";
import { FileSystemBasedProject } from "./FileSystemBasedProject";

export class CpsProject extends FileSystemBasedProject {
    private references: ProjectReference[] = [];
    private packages: PackageReference[] = [];
    private document: any = null;
    private loaded: boolean = false;

    constructor(projectInSolution: ProjectInSolution, document?: any) {
        super(projectInSolution, 'cps');

        if (document) {
            this.parseDocument(document);
            this.loaded = true;
        }
    }

    public async refresh(): Promise<void> {
        this.loaded = false;
        await this.checkProjectLoaded();
    }

    public async getProjectReferences(): Promise<ProjectReference[]> {
        await this.checkProjectLoaded();
        return this.references;
    }

    public async getPackageReferences(): Promise<PackageReference[]> {
        await this.checkProjectLoaded();
        return this.packages;
    }

    public async getProjectFilesAndFolders(virtualPath?: string): Promise<{ files: ProjectFile[], folders: ProjectFolder[] }> {
        let result = await super.getProjectFilesAndFolders(virtualPath);
        let files: ProjectFile[] = [];
        let folders: ProjectFolder[] = [];

        let ignore = SolutionExplorerConfiguration.getNetCoreIgnore();
        result.files.forEach(file => {
            if (!this.fullPath.endsWith(file.fullPath) && ignore.indexOf(file.name.toLocaleLowerCase()) < 0)
                files.push(file);
        });

        
        result.folders.forEach(folder => {
            if (ignore.indexOf(folder.name.toLocaleLowerCase()) < 0)
                folders.push(folder);
        });
        
        return { files, folders };
    }

    private async checkProjectLoaded() {
        if (this.loaded) return;

        await this.parseProject(this.fullPath);
        this.loaded = true;
    }

    private async parseProject(projectPath: string): Promise<void> {
        let content = await fs.readFile(projectPath, 'utf8');
        let document = await xml.ParseToJson(content);
        this.parseDocument(document);
    }

    private parseDocument(document: any): void {
        this.document = document;
        if (!this.document.Project.ItemGroup) return;

        this.document.Project.ItemGroup.forEach(items => {
            if (items.PackageReference) {
                items.PackageReference.forEach(pack => {
                    this.packages.push(new PackageReference(pack.$.Include, pack.$.Version));
                });
            }

            if (items.ProjectReference) {
                items.ProjectReference.forEach(reference => {
                    let ref = reference.$.Include.replace(/\\/g, path.sep).trim();
                    ref = ref.split(path.sep).pop();
                    let extension = ref.split('.').pop();
                    ref = ref.substring(0, ref.length - extension.length - 1);
                    this.references.push(new ProjectReference(ref));
                });
            }
        });
    }
}